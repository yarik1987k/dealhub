<?php
/**
 * One-time demo content import.
 *
 * Activating the theme on a fresh install produces a homepage that already
 * matches the design, so the section can be reviewed without anyone first
 * having to create a page, upload eleven assets and fill in five repeater
 * rows by hand.
 *
 * It runs once, is guarded by an option, and never touches content that
 * already exists. Delete this file (and its require in functions.php) to ship
 * the theme without it.
 *
 * @package DealHub
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

const DEALHUB_DEMO_FLAG = 'dealhub_demo_content_imported';

/**
 * Seed demo content when the theme is activated.
 */
function dealhub_maybe_import_demo_content(): void {
	if ( get_option( DEALHUB_DEMO_FLAG ) ) {
		return;
	}

	if ( ! dealhub_has_acf_pro() ) {
		return; // Field keys would resolve to nothing; try again next activation.
	}

	$page_id = dealhub_create_demo_homepage();

	if ( $page_id ) {
		update_option( DEALHUB_DEMO_FLAG, time() );
	}
}
add_action( 'after_switch_theme', 'dealhub_maybe_import_demo_content' );

/**
 * Copy a bundled demo asset into the media library.
 *
 * Re-importing is avoided by tagging each attachment with the source
 * filename, so repeated activations do not fill the library with duplicates.
 *
 * @param string $filename File inside /assets/demo.
 * @param string $alt      Alt text.
 * @return int Attachment ID, or 0 on failure.
 */
function dealhub_import_demo_image( string $filename, string $alt ): int {
	$existing = get_posts(
		array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => 1,
			'fields'         => 'ids',
			'meta_key'       => '_dealhub_demo_asset', // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- one-off import.
			'meta_value'     => $filename, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value -- one-off import.
		)
	);

	if ( ! empty( $existing ) ) {
		return (int) $existing[0];
	}

	$source = DEALHUB_DIR . '/assets/demo/' . $filename;

	if ( ! file_exists( $source ) ) {
		return 0;
	}

	$contents = file_get_contents( $source ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local theme file.

	if ( false === $contents ) {
		return 0;
	}

	$upload = wp_upload_bits( $filename, null, $contents );

	if ( ! empty( $upload['error'] ) ) {
		return 0;
	}

	$attachment_id = wp_insert_attachment(
		array(
			'post_mime_type' => 'image/png',
			'post_title'     => sanitize_file_name( pathinfo( $filename, PATHINFO_FILENAME ) ),
			'post_content'   => '',
			'post_status'    => 'inherit',
		),
		$upload['file']
	);

	if ( is_wp_error( $attachment_id ) || ! $attachment_id ) {
		return 0;
	}

	require_once ABSPATH . 'wp-admin/includes/image.php';

	wp_update_attachment_metadata(
		$attachment_id,
		wp_generate_attachment_metadata( $attachment_id, $upload['file'] )
	);

	update_post_meta( $attachment_id, '_wp_attachment_image_alt', $alt );
	update_post_meta( $attachment_id, '_dealhub_demo_asset', $filename );

	return (int) $attachment_id;
}

/**
 * The demo case studies.
 *
 * @return array<int,array<string,mixed>>
 */
function dealhub_demo_cases(): array {
	$poster    = dealhub_import_demo_image( 'video-poster.png', 'Colin Tanner speaking to camera' );
	$badge     = dealhub_import_demo_image( 'badge-lockup.png', 'DealHub and Liferaft' );
	$cpq       = dealhub_import_demo_image( 'icon-cpq.png', 'CPQ' );
	$dealroom  = dealhub_import_demo_image( 'icon-dealroom.png', 'DealRoom' );
	$sfdc      = dealhub_import_demo_image( 'icon-salesforce.png', 'Salesforce' );

	$solutions = array(
		array(
			'icon'  => $cpq,
			'label' => 'CPQ',
		),
		array(
			'icon'  => $dealroom,
			'label' => 'DealRoom',
		),
	);

	$crm = array(
		array(
			'icon'  => $sfdc,
			'label' => 'Salesforce',
		),
	);

	return array(
		array(
			'tab_label'       => 'Zapier',
			'video_source'    => 'wistia',
			'video_wistia_id' => 'qgc9lp34r1',
			'tab_logo'     => dealhub_import_demo_image( 'logo-zapier.png', 'Zapier' ),
			'quote'        => "Pricing changes ship the same day they are approved. What used to sit in a two-week ticket queue is now a workflow our own team runs.",
			'author_name'  => 'Maya Ellis',
			'author_role'  => 'Director of Revenue Operations',
			'video_poster' => $poster,
			'video_name'   => 'Maya Ellis',
			'video_badge'  => $badge,
			'solutions'    => $solutions,
			'crm_items'    => $crm,
			'stats'        => array(
				array(
					'value'   => '4x',
					'caption' => 'Faster quote turnaround',
				),
				array(
					'value'   => '92%',
					'caption' => 'First-time quote accuracy',
				),
				array(
					'value'   => '2 geo',
					'caption' => 'US, EMEA',
				),
			),
		),
		array(
			'tab_label'    => 'Intuit',
			'tab_logo'     => dealhub_import_demo_image( 'logo-intuit.png', 'Intuit' ),
			'quote'        => "Every time that we need to make any change, we don't need to reach out to support. We are independent and we can make those changes ourselves, in minutes rather than weeks.",
			'author_name'  => 'Johnathan Smith Cole',
			'author_role'  => 'Senior Director, GTM Operations',
			'cta'          => array(
				'title'  => 'Case Study',
				'url'    => '#',
				'target' => '',
			),
			'video_source'    => 'wistia',
			'video_wistia_id' => 'o5llpi4eyi',
			'video_poster' => $poster,
			'video_badge'  => $badge,
			'video_name'   => 'Colin Tanner',
			'solutions'    => $solutions,
			'crm_items'    => $crm,
			'stats'        => array(
				array(
					'value'   => '100%',
					'caption' => 'Adoption without resistance',
				),
				array(
					'value'   => '3 wk',
					'caption' => 'Implementation time',
				),
				array(
					'value'   => '3 geo',
					'caption' => 'EMEA, APAC, US',
				),
			),
		),
		array(
			'tab_label'       => 'Socure',
			'video_source'    => 'wistia',
			'video_wistia_id' => 'ocfkuodtbc',
			'tab_logo'     => dealhub_import_demo_image( 'logo-socure.png', 'Socure' ),
			'quote'        => 'Approvals used to be the slowest part of every deal. Routing them automatically took a week out of our average cycle without adding a single process step.',
			'author_name'  => 'Daniel Okafor',
			'author_role'  => 'VP Sales Operations',
			'video_poster' => $poster,
			'video_name'   => 'Daniel Okafor',
			'video_badge'  => $badge,
			'solutions'    => $solutions,
			'crm_items'    => $crm,
			'stats'        => array(
				array(
					'value'   => '-7 days',
					'caption' => 'Average deal cycle',
				),
				array(
					'value'   => '3 wk',
					'caption' => 'Implementation time',
				),
				array(
					'value'   => '1 geo',
					'caption' => 'US',
				),
			),
		),
		array(
			'tab_label'       => 'Tipalti',
			'video_source'    => 'wistia',
			'video_wistia_id' => '74wooekfbn',
			'tab_logo'     => dealhub_import_demo_image( 'logo-tipalti.png', 'Tipalti' ),
			'quote'        => 'Reps build their own quotes now. Finance still gets clean, on-brand paperwork at the end of it, which is the part nobody believed we could have both of.',
			'author_name'  => 'Priya Raman',
			'author_role'  => 'Head of Deal Desk',
			'video_poster' => $poster,
			'video_name'   => 'Priya Raman',
			'video_badge'  => $badge,
			'solutions'    => $solutions,
			'crm_items'    => $crm,
			'stats'        => array(
				array(
					'value'   => '85%',
					'caption' => 'Quotes built self-serve',
				),
				array(
					'value'   => '2 wk',
					'caption' => 'Implementation time',
				),
				array(
					'value'   => '4 geo',
					'caption' => 'US, EMEA, APAC, LATAM',
				),
			),
		),
		array(
			'tab_label'       => 'Redis',
			'video_source'    => 'wistia',
			'video_wistia_id' => 'utljn8yads',
			'tab_logo'     => dealhub_import_demo_image( 'logo-redis.png', 'Redis' ),
			'quote'        => 'We replaced four disconnected tools with one workflow. The measurable win was cycle time; the one people talk about is that nobody argues about which document is current.',
			'author_name'  => 'Erin Vasquez',
			'author_role'  => 'Senior Manager, GTM Systems',
			'video_poster' => $poster,
			'video_name'   => 'Erin Vasquez',
			'video_badge'  => $badge,
			'solutions'    => $solutions,
			'crm_items'    => $crm,
			'stats'        => array(
				array(
					'value'   => '4 → 1',
					'caption' => 'Tools in the quoting stack',
				),
				array(
					'value'   => '3 wk',
					'caption' => 'Implementation time',
				),
				array(
					'value'   => '3 geo',
					'caption' => 'US, EMEA, APAC',
				),
			),
		),
	);
}

/**
 * Flatten the demo cases into ACF's block data format.
 *
 * ACF blocks store field values inside the block comment, flattened the same
 * way they would be in postmeta: `tabs_0_quote` for the value and
 * `_tabs_0_quote` for the field key it belongs to.
 *
 * @return array<string,mixed>
 */
function dealhub_build_block_data(): array {
	$cases = dealhub_demo_cases();

	$data = array(
		'heading_lead'       => 'Loved. Adopted.',
		'_heading_lead'      => 'field_dh_heading_lead',
		'heading_highlight'  => 'Trusted',
		'_heading_highlight' => 'field_dh_heading_highlight',
		'heading_underline'  => 1,
		'_heading_underline' => 'field_dh_heading_underline',
		'tabs'               => count( $cases ),
		'_tabs'              => 'field_dh_tabs',
	);

	$keys = array(
		'tab_label'       => 'field_dh_tab_label',
		'tab_logo'        => 'field_dh_tab_logo',
		'quote'           => 'field_dh_quote',
		'author_name'     => 'field_dh_author_name',
		'author_role'     => 'field_dh_author_role',
		'cta'             => 'field_dh_cta',
		'video_source'    => 'field_dh_video_source',
		'video_file'      => 'field_dh_video_file',
		'video_url'       => 'field_dh_video_url',
		'video_wistia_id' => 'field_dh_video_wistia',
		'video_poster'    => 'field_dh_video_poster',
		'video_badge'     => 'field_dh_video_badge',
		'video_name'      => 'field_dh_video_name',
		'solutions_label' => 'field_dh_solutions_label',
		'crm_label'       => 'field_dh_crm_label',
	);

	$defaults = array(
		'video_source'    => 'none',
		'solutions_label' => 'Solutions used',
		'crm_label'       => 'CRM used',
	);

	foreach ( $cases as $i => $case ) {
		$case = array_merge( $defaults, $case );

		foreach ( $keys as $name => $key ) {
			$data[ "tabs_{$i}_{$name}" ]  = $case[ $name ] ?? '';
			$data[ "_tabs_{$i}_{$name}" ] = $key;
		}

		$sub_repeaters = array(
			'solutions' => array(
				'key'  => 'field_dh_solutions',
				'subs' => array(
					'icon'  => 'field_dh_solution_icon',
					'label' => 'field_dh_solution_label',
				),
			),
			'crm_items' => array(
				'key'  => 'field_dh_crm_items',
				'subs' => array(
					'icon'  => 'field_dh_crm_icon',
					'label' => 'field_dh_crm_item_label',
				),
			),
			'stats'     => array(
				'key'  => 'field_dh_stats',
				'subs' => array(
					'value'   => 'field_dh_stat_value',
					'caption' => 'field_dh_stat_caption',
				),
			),
		);

		foreach ( $sub_repeaters as $name => $config ) {
			$rows = $case[ $name ] ?? array();

			$data[ "tabs_{$i}_{$name}" ]  = count( $rows );
			$data[ "_tabs_{$i}_{$name}" ] = $config['key'];

			foreach ( $rows as $j => $row ) {
				foreach ( $config['subs'] as $sub_name => $sub_key ) {
					$data[ "tabs_{$i}_{$name}_{$j}_{$sub_name}" ]  = $row[ $sub_name ] ?? '';
					$data[ "_tabs_{$i}_{$name}_{$j}_{$sub_name}" ] = $sub_key;
				}
			}
		}
	}

	return $data;
}

/**
 * Create the homepage and point the site at it.
 *
 * @return int Page ID, or 0 on failure.
 */
function dealhub_create_demo_homepage(): int {
	/*
	 * `mode` is stored per block instance and takes precedence over the
	 * default in block.json, so it has to say 'auto' here too. 'preview'
	 * would pin the seeded block to preview-only and force every field edit
	 * through the narrow sidebar inspector.
	 */
	$attributes = array(
		'name'  => 'dealhub/case-study-tabs',
		'data'  => dealhub_build_block_data(),
		'mode'  => 'auto',
		'align' => 'full',
	);

	$content = sprintf(
		'<!-- wp:dealhub/case-study-tabs %s /-->',
		wp_json_encode( $attributes, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE )
	);

	$existing = get_page_by_path( 'home' );

	if ( $existing instanceof WP_Post ) {
		$page_id = (int) $existing->ID;

		wp_update_post(
			array(
				'ID'           => $page_id,
				'post_content' => $content,
			)
		);
	} else {
		$page_id = wp_insert_post(
			array(
				'post_title'   => 'Home',
				'post_name'    => 'home',
				'post_type'    => 'page',
				'post_status'  => 'publish',
				'post_content' => $content,
			)
		);
	}

	if ( is_wp_error( $page_id ) || ! $page_id ) {
		return 0;
	}

	update_option( 'show_on_front', 'page' );
	update_option( 'page_on_front', $page_id );

	return (int) $page_id;
}
