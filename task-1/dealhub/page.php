<?php
/**
 * Page template.
 *
 * @package DealHub
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

get_header();

while ( have_posts() ) {
	the_post();
	the_content();
}

get_footer();
