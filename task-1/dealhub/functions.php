<?php
/**
 * DealHub theme bootstrap.
 *
 * @package DealHub
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

define( 'DEALHUB_VERSION', wp_get_theme()->get( 'Version' ) ?: '1.0.0' );
define( 'DEALHUB_DIR', get_template_directory() );
define( 'DEALHUB_URI', get_template_directory_uri() );

require_once DEALHUB_DIR . '/inc/setup.php';
require_once DEALHUB_DIR . '/inc/assets.php';
require_once DEALHUB_DIR . '/inc/helpers.php';
require_once DEALHUB_DIR . '/inc/acf.php';
require_once DEALHUB_DIR . '/inc/blocks.php';
require_once DEALHUB_DIR . '/inc/demo-content.php';
