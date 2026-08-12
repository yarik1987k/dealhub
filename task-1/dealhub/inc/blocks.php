<?php
/**
 * Block registration.
 *
 * Blocks are registered from their block.json manifests rather than through
 * acf_register_block_type(). That is ACF's current recommended path and it
 * buys three things for free:
 *
 *   - `style` / `viewScript` are only enqueued on pages containing the block
 *   - the block appears in the inserter with a real preview via `example`
 *   - metadata stays declarative and translatable
 *
 * Every directory under /blocks holding a block.json is registered, so adding
 * a second block later needs no PHP changes.
 *
 * @package DealHub
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

/**
 * Register all theme blocks.
 */
function dealhub_register_blocks(): void {
	if ( ! dealhub_has_acf_pro() ) {
		return;
	}

	$manifests = glob( DEALHUB_DIR . '/blocks/*/block.json' );

	if ( empty( $manifests ) ) {
		return;
	}

	foreach ( $manifests as $manifest ) {
		register_block_type( dirname( $manifest ) );
	}
}
add_action( 'init', 'dealhub_register_blocks' );

/**
 * Give the theme's blocks their own group in the inserter.
 *
 * Prepended rather than appended so it sits above the core groups — an
 * editor looking for a project block should not have to scroll past Text,
 * Media and Design to find it.
 *
 * The slug is referenced by `category` in each block.json. Changing it here
 * without changing it there drops the block into the inserter's uncategorised
 * bucket, so the two must move together.
 *
 * @param array<int,array<string,mixed>> $categories Registered categories.
 * @return array<int,array<string,mixed>>
 */
function dealhub_block_category( array $categories ): array {
	array_unshift(
		$categories,
		array(
			'slug'  => 'dealhub',
			'title' => __( 'DealHub', 'dealhub' ),
			'icon'  => null,
		)
	);

	return $categories;
}
add_filter( 'block_categories_all', 'dealhub_block_category' );

/**
 * Restrict the inserter to the blocks this project actually uses.
 *
 * Keeps the editing experience focused on the deliverable instead of
 * offering ~90 core blocks that were never designed for.
 *
 * @param bool|array<int,string> $allowed Allowed block types.
 * @param WP_Block_Editor_Context $context Editor context.
 * @return bool|array<int,string>
 */
function dealhub_allowed_block_types( $allowed, $context ) {
	if ( empty( $context->post ) || 'page' !== $context->post->post_type ) {
		return $allowed;
	}

	return array(
		'dealhub/case-study-tabs',
		'core/paragraph',
		'core/heading',
		'core/image',
		'core/spacer',
	);
}
add_filter( 'allowed_block_types_all', 'dealhub_allowed_block_types', 10, 2 );
