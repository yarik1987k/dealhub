<?php
/**
 * Theme supports and general setup.
 *
 * @package DealHub
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

/**
 * Register theme supports.
 */
function dealhub_setup(): void {
	load_theme_textdomain( 'dealhub', DEALHUB_DIR . '/languages' );

	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'align-wide' );
	add_theme_support( 'editor-styles' );
	add_theme_support( 'wp-block-styles' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );

	/*
	 * The editor canvas is an iframe. `enqueue_block_editor_assets` loads into
	 * the surrounding admin page, not into that iframe, so anything the block
	 * preview depends on has to come through here. tokens.css must be first —
	 * the block's own stylesheet (loaded from block.json) resolves its custom
	 * properties against it.
	 */
	add_editor_style(
		array(
			'assets/css/fonts.css',
			'assets/css/tokens.css',
			'assets/css/editor.css',
		)
	);

	register_nav_menus(
		array(
			'primary' => __( 'Primary Menu', 'dealhub' ),
		)
	);
}
add_action( 'after_setup_theme', 'dealhub_setup' );

/**
 * Allow SVG uploads for logos and icons.
 *
 * Restricted to users who can already inject arbitrary markup
 * (`unfiltered_html`), which on a single site means administrators and
 * editors. Anything less is a stored-XSS vector, since SVG can carry script.
 *
 * @param array<string,string> $mimes Allowed mime types.
 * @return array<string,string>
 */
function dealhub_allow_svg_uploads( array $mimes ): array {
	if ( current_user_can( 'unfiltered_html' ) ) {
		$mimes['svg'] = 'image/svg+xml';
	}

	return $mimes;
}
add_filter( 'upload_mimes', 'dealhub_allow_svg_uploads' );

/**
 * Trim the front-end of things this project does not need.
 */
function dealhub_cleanup(): void {
	remove_action( 'wp_head', 'wp_generator' );
	remove_action( 'wp_head', 'wlwmanifest_link' );
	remove_action( 'wp_head', 'rsd_link' );
}
add_action( 'init', 'dealhub_cleanup' );
