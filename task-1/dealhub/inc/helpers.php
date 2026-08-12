<?php
/**
 * Template helpers.
 *
 * @package DealHub
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

/**
 * Render an ACF image field as a responsive <img>.
 *
 * Goes through wp_get_attachment_image() rather than hand-writing the tag so
 * we inherit srcset, sizes and native lazy-loading. SVGs have no intrinsic
 * size in the media library, so they are emitted directly instead.
 *
 * @param mixed                $image ACF image array, attachment ID, or false.
 * @param string               $size  Registered image size.
 * @param array<string,string> $attrs Extra HTML attributes.
 * @param string               $alt_fallback Alt text when the attachment has none.
 * @return string Escaped HTML, or an empty string.
 */
function dealhub_image( $image, string $size = 'medium', array $attrs = array(), string $alt_fallback = '' ): string {
	$id = 0;

	if ( is_array( $image ) && isset( $image['ID'] ) ) {
		$id = (int) $image['ID'];
	} elseif ( is_numeric( $image ) ) {
		$id = (int) $image;
	}

	if ( ! $id ) {
		return '';
	}

	$existing_alt = (string) get_post_meta( $id, '_wp_attachment_image_alt', true );

	if ( '' === $existing_alt && '' !== $alt_fallback ) {
		$attrs['alt'] = $alt_fallback;
	}

	// SVGs report no width/height, which makes wp_get_attachment_image emit a
	// broken srcset. Output the file directly and let CSS size it.
	if ( 'image/svg+xml' === get_post_mime_type( $id ) ) {
		$src = wp_get_attachment_url( $id );

		if ( ! $src ) {
			return '';
		}

		$attrs['src'] = $src;
		$attrs['alt'] = $attrs['alt'] ?? $existing_alt;

		if ( ! isset( $attrs['loading'] ) ) {
			$attrs['loading'] = 'lazy';
		}

		$html = '<img';
		foreach ( $attrs as $name => $value ) {
			$html .= sprintf( ' %s="%s"', esc_attr( (string) $name ), esc_attr( (string) $value ) );
		}

		return $html . ' />';
	}

	return wp_get_attachment_image( $id, $size, false, $attrs );
}

/**
 * Resolve a YouTube or Vimeo URL into an embeddable player URL.
 *
 * Only these two providers are supported deliberately: a generic oEmbed call
 * would hit the network on every render and return markup we cannot style or
 * lazy-load. Returns null for anything unrecognised so the caller can fall
 * back to a plain link rather than embedding something unexpected.
 *
 * @param string $url Watch or share URL.
 * @return array{provider:string,id:string,embed:string}|null
 */
function dealhub_parse_video_url( string $url ): ?array {
	$url = trim( $url );

	if ( '' === $url ) {
		return null;
	}

	$patterns = array(
		'youtube' => '#(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{6,20})#i',
		'vimeo'   => '#vimeo\.com/(?:video/|channels/[A-Za-z0-9_-]+/|groups/[A-Za-z0-9_-]+/videos/)?(\d{6,12})#i',
	);

	foreach ( $patterns as $provider => $pattern ) {
		if ( ! preg_match( $pattern, $url, $matches ) ) {
			continue;
		}

		$id = $matches[1];

		// youtube-nocookie keeps the embed out of the visitor's ad profile
		// until they actually press play.
		$embed = 'youtube' === $provider
			? sprintf( 'https://www.youtube-nocookie.com/embed/%s?autoplay=1&rel=0&modestbranding=1&playsinline=1', rawurlencode( $id ) )
			: sprintf( 'https://player.vimeo.com/video/%s?autoplay=1&dnt=1', rawurlencode( $id ) );

		return array(
			'provider' => $provider,
			'id'       => $id,
			'embed'    => $embed,
		);
	}

	return null;
}

/**
 * Which player a row resolves to.
 *
 * @param array|null  $embed  Parsed YouTube/Vimeo embed.
 * @param string|null $wistia Wistia media ID.
 * @param string      $file   Uploaded file URL.
 * @return string
 */
function dealhub_video_type( ?array $embed, ?string $wistia, string $file ): string {
	if ( $embed ) {
		return $embed['provider'];
	}

	if ( $wistia ) {
		return 'wistia';
	}

	return '' !== $file ? 'file' : '';
}

/**
 * The URL the facade loads on play.
 *
 * @param array|null  $embed  Parsed YouTube/Vimeo embed.
 * @param string|null $wistia Wistia media ID.
 * @param string      $file   Uploaded file URL.
 * @return string
 */
function dealhub_video_src( ?array $embed, ?string $wistia, string $file ): string {
	if ( $embed ) {
		return $embed['embed'];
	}

	if ( $wistia ) {
		/*
		 * Wistia is loaded through its SDK rather than an iframe, so the src
		 * is not a URL — view.js injects <wistia-player> and pulls player.js
		 * in on demand. Kept out of the markup entirely until then, so an
		 * unwatched video still costs nothing.
		 */
		return '';
	}

	return $file;
}

/**
 * Extract a Wistia media ID.
 *
 * Accepts either a bare hashed ID as the CMS stores it (`qgc9lp34r1`) or any
 * Wistia URL an editor might paste from the dashboard. Returning null for
 * anything else keeps unvalidated input out of the embed URL.
 *
 * @param string $value Hashed ID or Wistia URL.
 * @return string|null
 */
function dealhub_parse_wistia_id( string $value ): ?string {
	$value = trim( $value );

	if ( '' === $value ) {
		return null;
	}

	// Bare hashed ID.
	if ( preg_match( '/^[a-z0-9]{8,16}$/i', $value ) ) {
		return $value;
	}

	// medias/<id>, iframe/<id>, embed/<id>, or a .../<id> tail.
	if ( preg_match( '#wistia\.(?:net|com)/(?:embed/)?(?:iframe|medias|videos)/([a-z0-9]{8,16})#i', $value, $m ) ) {
		return $m[1];
	}

	return null;
}

/**
 * Wistia's own thumbnail for a media, via its public oEmbed endpoint.
 *
 * Used only when no poster has been uploaded, so an editor who fills in a
 * media ID and nothing else still gets a real still rather than an empty box.
 *
 * The lookup is a network call, so it is cached in a transient — a week on
 * success, an hour on failure so a Wistia outage cannot turn every page render
 * into a fresh timeout. Failure returns null and the caller falls back to the
 * plain background.
 *
 * @param string $id     Wistia media ID.
 * @param int    $width  Requested width.
 * @param int    $height Requested height.
 * @return string|null Image URL, or null.
 */
function dealhub_wistia_thumbnail( string $id, int $width = 720, int $height = 1280 ): ?string {
	$key    = 'dh_wistia_thumb_' . md5( $id . "|{$width}x{$height}" );
	$cached = get_transient( $key );

	if ( false !== $cached ) {
		return '' === $cached ? null : $cached;
	}

	$response = wp_remote_get(
		add_query_arg(
			'url',
			rawurlencode( 'https://home.wistia.com/medias/' . $id ),
			'https://fast.wistia.com/oembed'
		),
		array( 'timeout' => 3 )
	);

	$url = null;

	if ( ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response ) ) {
		$data = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( ! empty( $data['thumbnail_url'] ) ) {
			// Wistia bakes a size into the returned URL; swap in ours.
			$url = add_query_arg(
				'image_crop_resized',
				"{$width}x{$height}",
				remove_query_arg( 'image_crop_resized', $data['thumbnail_url'] )
			);
		}
	}

	set_transient( $key, $url ?? '', $url ? WEEK_IN_SECONDS : HOUR_IN_SECONDS );

	return $url;
}

/**
 * The poster markup for a case study's media.
 *
 * Prefers the uploaded image, because that is the one an editor controls and
 * the one WordPress can serve responsively. Falls back to Wistia's still.
 *
 * @param array<string,mixed> $case  Normalised case row.
 * @param string              $label Accessible description of the video.
 * @return string
 */
function dealhub_video_poster( array $case, string $label ): string {
	$uploaded = dealhub_image(
		$case['video_poster'],
		'large',
		array( 'class' => 'dh-video__poster' ),
		$label
	);

	if ( '' !== $uploaded ) {
		return $uploaded;
	}

	if ( 'wistia' !== $case['video_type'] || '' === $case['video_id'] ) {
		return '';
	}

	$url = dealhub_wistia_thumbnail( $case['video_id'] );

	if ( ! $url ) {
		return '';
	}

	return sprintf(
		'<img class="dh-video__poster" src="%s" alt="%s" loading="lazy" decoding="async" />',
		esc_url( $url ),
		esc_attr( $label )
	);
}

/**
 * Normalise one repeater row of the `tabs` field into a predictable shape.
 *
 * Keeps render.php free of isset() noise and gives every downstream template
 * the same keys whether or not the editor filled a field in.
 *
 * @param array<string,mixed> $row Raw ACF row.
 * @return array<string,mixed>
 */
function dealhub_normalise_case( array $row ): array {
	$source = $row['video_source'] ?? 'file';
	$embed  = null;

	if ( 'url' === $source && ! empty( $row['video_url'] ) ) {
		$embed = dealhub_parse_video_url( (string) $row['video_url'] );
	}

	$file_url = '';
	if ( 'file' === $source && ! empty( $row['video_file']['url'] ) ) {
		$file_url = (string) $row['video_file']['url'];
	}

	$wistia = null;
	if ( 'wistia' === $source ) {
		$wistia = dealhub_parse_wistia_id( (string) ( $row['video_wistia_id'] ?? '' ) );
	}

	$has_video = ( 'none' !== $source ) && ( '' !== $file_url || null !== $embed || null !== $wistia );

	/*
	 * A poster with no video is a legitimate editorial case — a still portrait
	 * of the customer instead of a testimonial clip. The media card still
	 * renders; it just has no play button.
	 */
	$has_media = $has_video || ! empty( $row['video_poster'] );

	return array(
		'label'           => (string) ( $row['tab_label'] ?? '' ),
		'tab_logo'        => $row['tab_logo'] ?? null,
		'quote'           => (string) ( $row['quote'] ?? '' ),
		'author_name'     => (string) ( $row['author_name'] ?? '' ),
		'author_role'     => (string) ( $row['author_role'] ?? '' ),
		'cta'             => is_array( $row['cta'] ?? null ) ? $row['cta'] : null,
		'has_video'       => $has_video,
		'has_media'       => $has_media,
		'video_type'      => dealhub_video_type( $embed, $wistia, $file_url ),
		'video_src'       => dealhub_video_src( $embed, $wistia, $file_url ),
		'video_id'        => (string) ( $wistia ?? '' ),
		'video_poster'    => $row['video_poster'] ?? null,
		'video_badge'     => $row['video_badge'] ?? null,
		'video_name'      => (string) ( $row['video_name'] ?? '' ),
		'solutions_label' => (string) ( $row['solutions_label'] ?? '' ),
		'solutions'       => is_array( $row['solutions'] ?? null ) ? $row['solutions'] : array(),
		'crm_label'       => (string) ( $row['crm_label'] ?? '' ),
		'crm_items'       => is_array( $row['crm_items'] ?? null ) ? $row['crm_items'] : array(),
		'stats'           => is_array( $row['stats'] ?? null ) ? $row['stats'] : array(),
	);
}
