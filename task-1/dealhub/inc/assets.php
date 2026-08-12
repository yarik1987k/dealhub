<?php
/**
 * Asset loading.
 *
 * Block-specific CSS/JS is NOT enqueued here. Each block declares its own
 * `style` and `viewScript` in block.json, so WordPress loads them only on
 * pages where the block is actually present.
 *
 * @package DealHub
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

/**
 * Enqueue the global stylesheet (tokens + reset only).
 */
function dealhub_enqueue_assets(): void {
	wp_enqueue_style(
		'dealhub-fonts',
		DEALHUB_URI . '/assets/css/fonts.css',
		array(),
		dealhub_asset_version( '/assets/css/fonts.css' )
	);

	wp_enqueue_style(
		'dealhub-tokens',
		DEALHUB_URI . '/assets/css/tokens.css',
		array( 'dealhub-fonts' ),
		dealhub_asset_version( '/assets/css/tokens.css' )
	);

	wp_enqueue_style(
		'dealhub-base',
		DEALHUB_URI . '/assets/css/base.css',
		array( 'dealhub-tokens' ),
		dealhub_asset_version( '/assets/css/base.css' )
	);
}
add_action( 'wp_enqueue_scripts', 'dealhub_enqueue_assets' );

/*
 * Note: the editor gets tokens.css through add_editor_style() in setup.php,
 * not from here. enqueue_block_editor_assets targets the admin page around
 * the canvas, but the canvas itself is an iframe — styles registered there
 * never reach the block preview.
 */

/**
 * Cache-bust the block's own assets from their modification time.
 *
 * Assets declared in block.json are registered by WordPress, not by this
 * theme, and core only versions them by file time when SCRIPT_DEBUG is on
 * (see `register_block_style_handle()`). Otherwise they inherit the
 * WordPress version, so an edited stylesheet stays hidden behind the browser
 * cache until core itself updates — which is precisely the wrong behaviour
 * for the file that changes most.
 *
 * Filtering at print time covers styles and scripts registered from any
 * block.json under this theme, without needing a debug constant.
 *
 * @param string $src    Asset URL.
 * @param string $handle Registered handle.
 * @return string
 */
function dealhub_version_block_assets( string $src, string $handle ): string {
	if ( 0 !== strpos( $handle, 'dealhub-' ) ) {
		return $src;
	}

	$path = str_replace( DEALHUB_URI, DEALHUB_DIR, strtok( $src, '?' ) );

	if ( $path && file_exists( $path ) ) {
		$src = add_query_arg( 'ver', (string) filemtime( $path ), $src );
	}

	return $src;
}
add_filter( 'style_loader_src', 'dealhub_version_block_assets', 10, 2 );
add_filter( 'script_loader_src', 'dealhub_version_block_assets', 10, 2 );

/**
 * Cache-bust from the file's modification time.
 *
 * Not gated behind WP_DEBUG: mtime is stable for as long as the file is
 * unchanged, so it behaves like a version number in production while still
 * busting the cache the moment a stylesheet is edited. Gating it meant every
 * edit on a site without WP_DEBUG stayed hidden behind the browser cache.
 *
 * @param string $relative_path Path relative to the theme root, leading slash.
 * @return string
 */
function dealhub_asset_version( string $relative_path ): string {
	$file = DEALHUB_DIR . $relative_path;

	if ( file_exists( $file ) ) {
		return (string) filemtime( $file );
	}

	return DEALHUB_VERSION;
}
