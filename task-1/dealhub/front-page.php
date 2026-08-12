<?php
/**
 * Homepage template.
 *
 * The homepage is a normal page whose content is the case-study tabs block,
 * so the whole section stays editable in Gutenberg rather than being
 * hard-coded here. This template only supplies the document shell.
 *
 * @package DealHub
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

get_header();

if ( have_posts() ) {
	while ( have_posts() ) {
		the_post();
		the_content();
	}
}

get_footer();
