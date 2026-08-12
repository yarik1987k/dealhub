<?php
/**
 * ACF integration.
 *
 * Field groups are stored as JSON in /acf-json and loaded from there, so the
 * field configuration is version-controlled with the theme rather than living
 * only in the database. Editing a field group in wp-admin rewrites the JSON
 * file; deploying the theme to a fresh site brings the fields with it.
 *
 * @package DealHub
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

/**
 * Write field group JSON into the theme instead of the default plugin folder.
 *
 * @param string $path Default save path.
 * @return string
 */
function dealhub_acf_json_save_point( string $path ): string {
	return DEALHUB_DIR . '/acf-json';
}
add_filter( 'acf/settings/save_json', 'dealhub_acf_json_save_point' );

/**
 * Read field group JSON from the theme.
 *
 * @param array<int,string> $paths Default load paths.
 * @return array<int,string>
 */
function dealhub_acf_json_load_point( array $paths ): array {
	unset( $paths[0] );
	$paths[] = DEALHUB_DIR . '/acf-json';

	return $paths;
}
add_filter( 'acf/settings/load_json', 'dealhub_acf_json_load_point' );

/**
 * Is a version of ACF capable of running this theme's blocks active?
 *
 * The block relies on Repeater fields and ACF Blocks, both of which are
 * ACF Pro features. `acf_get_setting( 'pro' )` is the documented way to
 * distinguish Pro from free at runtime.
 */
function dealhub_has_acf_pro(): bool {
	return function_exists( 'acf_register_block_type' )
		&& function_exists( 'acf_get_setting' )
		&& (bool) acf_get_setting( 'pro' );
}

/**
 * Tell the admin plainly when the dependency is missing.
 *
 * Without this the section simply renders empty on the front end, which is a
 * confusing failure mode for whoever installs the theme next.
 */
function dealhub_acf_dependency_notice(): void {
	if ( dealhub_has_acf_pro() || ! current_user_can( 'activate_plugins' ) ) {
		return;
	}

	$message = class_exists( 'ACF' )
		? __( 'DealHub theme: the free version of Advanced Custom Fields is active, but this theme requires <strong>ACF Pro</strong> (ACF Blocks and Repeater fields). The case-study tabs section will not render until ACF Pro is activated.', 'dealhub' )
		: __( 'DealHub theme: <strong>ACF Pro</strong> is required and does not appear to be active. The case-study tabs section will not render until it is activated.', 'dealhub' );

	printf(
		'<div class="notice notice-error"><p>%s</p></div>',
		wp_kses( $message, array( 'strong' => array() ) )
	);
}
add_action( 'admin_notices', 'dealhub_acf_dependency_notice' );
