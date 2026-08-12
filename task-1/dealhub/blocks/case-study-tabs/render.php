<?php
/**
 * Case Study Tabs — front-end and editor-preview template.
 *
 * Accessibility: this implements the WAI-ARIA Tabs pattern with manual
 * activation. The tab strip is a single tab stop (roving tabindex); arrow
 * keys move between tabs, Home/End jump to the ends, and Enter/Space or a
 * click activates. Panels stay in the DOM and are hidden with [hidden] so
 * search engines still see every case study.
 *
 * @package DealHub
 *
 * @param array<string,mixed> $block      Block settings.
 * @param string              $content    Block inner content.
 * @param bool                $is_preview True when rendering inside the editor.
 * @param int|string          $post_id    Post the block belongs to.
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || exit;

$dh_lead      = (string) get_field( 'heading_lead' );
$dh_highlight = (string) get_field( 'heading_highlight' );
$dh_underline = (bool) get_field( 'heading_underline' );
$dh_rows      = get_field( 'tabs' );
$dh_rows      = is_array( $dh_rows ) ? $dh_rows : array();

$dh_cases = array_values(
	array_filter(
		array_map( 'dealhub_normalise_case', $dh_rows ),
		static fn( array $case ): bool => '' !== $case['label']
	)
);

// A unique, stable prefix so several instances of the block on one page do
// not collide on element IDs.
$dh_uid = 'dh-' . substr( md5( (string) ( $block['id'] ?? wp_unique_id() ) ), 0, 8 );

$dh_classes = array( 'dh-cases' );

if ( ! empty( $block['className'] ) ) {
	$dh_classes[] = $block['className'];
}

if ( ! empty( $block['align'] ) ) {
	$dh_classes[] = 'align' . $block['align'];
}

$dh_anchor = ! empty( $block['anchor'] ) ? $block['anchor'] : $dh_uid;

// Editor affordance: an empty block should say what to do, not render a
// blank void that looks broken.
if ( empty( $dh_cases ) ) {
	if ( $is_preview ) {
		printf(
			'<div class="dh-placeholder"><strong>%s</strong><span>%s</span></div>',
			esc_html__( 'Case Study Tabs', 'dealhub' ),
			esc_html__( 'Add at least one case study in the block settings to preview this section.', 'dealhub' )
		);
	}

	return;
}
?>
<section
	id="<?php echo esc_attr( $dh_anchor ); ?>"
	class="<?php echo esc_attr( implode( ' ', $dh_classes ) ); ?>"
	aria-labelledby="<?php echo esc_attr( $dh_uid ); ?>-heading"
>
	<div class="dh-cases__inner">

		<?php
		/*
		 * The teal wash behind the card is a single blurred orb rather than a
		 * gradient on the card, which is why the card can stay a flat
		 * translucent surface and still read as lit from the upper left.
		 * Purely decorative, so it is hidden from assistive tech.
		 */
		?>
		<div class="dh-cases__glow" aria-hidden="true"></div>


		<?php if ( '' !== $dh_lead || '' !== $dh_highlight ) : ?>
			<h2 class="dh-cases__heading" id="<?php echo esc_attr( $dh_uid ); ?>-heading">
				<?php if ( '' !== $dh_lead ) : ?>
					<span class="dh-cases__heading-lead"><?php echo esc_html( $dh_lead ); ?></span>
				<?php endif; ?>

				<?php if ( '' !== $dh_highlight ) : ?>
					<span class="dh-cases__heading-mark<?php echo $dh_underline ? ' has-underline' : ''; ?>">
						<?php echo esc_html( $dh_highlight ); ?>
						<?php if ( $dh_underline ) : ?>
							<?php
							/*
							 * The gradient needs a document-unique id: two of these blocks on one
							 * page would otherwise both resolve url(#id) to the first definition,
							 * because the reference is scoped to the document, not to the SVG.
							 */
							$dh_grad = $dh_uid . '-underline';
							?>
							<svg class="dh-cases__underline" viewBox="0 0 236 27" fill="none" aria-hidden="true" focusable="false">
								<path d="M173.945 1.1666H199.125C199.436 1.1666 199.746 1.15682 200.057 1.1666C200.379 1.17883 200.68 1.11036 200.909 0.782662C201.376 0.117491 201.971 0.0123348 202.611 0.0147803C204.166 0.0270077 205.719 0.00744385 207.274 0.00499837C210.175 0.00255289 213.076 -0.00722904 215.977 0.00988934C216.748 0.0147803 217.523 -0.0634752 218.286 0.276447C218.614 0.423176 219.004 0.320466 219.367 0.330248C220.559 0.359593 221.75 0.386494 222.94 0.415839C223.465 0.428067 224.033 0.530777 224.261 1.19595C224.476 1.81955 224.04 2.37712 223.799 2.876C223.366 3.77593 222.742 4.37019 221.921 4.5536C221.267 4.69788 220.619 4.89107 219.969 5.07204C219.894 5.0916 219.829 5.16986 219.76 5.22121C219.858 5.25545 219.955 5.31903 220.053 5.31903C221.348 5.32637 222.658 5.49022 223.936 5.29458C227.189 4.80059 230.446 5.04514 233.701 4.98889C234.228 4.97911 234.727 5.05247 235.203 5.38995C235.42 5.54402 235.5 5.769 235.5 6.05023C235.5 6.32168 235.492 6.61514 235.42 6.86458C234.712 9.28805 234.05 9.8872 232.033 9.98012C231.876 9.98746 231.722 9.9948 231.566 9.99235C229.394 9.97279 227.242 10.4594 225.066 10.413C222.942 10.3665 220.809 10.2907 218.695 10.5132C214.405 10.9608 210.106 10.5939 205.823 10.9388C202.929 11.1711 200.037 11.1588 197.144 11.2175C194.243 11.2762 191.334 11.1173 188.441 11.3496C183.944 11.7115 179.434 11.4058 174.947 11.7727C171.793 12.0319 168.634 11.8387 165.495 12.1859C162.859 12.477 160.218 12.2642 157.596 12.5797C155.119 12.878 152.629 12.6946 150.167 13.0174C147.998 13.3011 145.824 13.1324 143.666 13.4087C141.553 13.6801 139.427 13.5579 137.325 13.8489C135.674 14.0763 134.015 13.9663 132.38 14.2328C130.423 14.5507 128.451 14.382 126.506 14.6779C124.804 14.9396 123.092 14.7928 121.407 15.0741C119.604 15.3724 117.786 15.2183 115.997 15.5069C114.348 15.771 112.687 15.6414 111.055 15.9129C109.406 16.1868 107.747 16.0596 106.112 16.3188C104.309 16.6049 102.494 16.4704 100.705 16.759C99.1595 17.0084 97.6019 16.8935 96.0731 17.1674C94.5275 17.4462 92.9699 17.3092 91.4411 17.5758C89.8955 17.8448 88.3403 17.7372 86.8116 17.9891C85.3189 18.2336 83.8119 18.1383 82.3361 18.4097C80.894 18.6763 79.4399 18.5564 78.0171 18.8377C76.7291 19.092 75.4314 18.9746 74.1627 19.2387C72.8241 19.5151 71.4808 19.4246 70.1518 19.6422C68.6616 19.8868 67.1569 19.8428 65.6788 20.102C64.4413 20.3172 63.2087 20.3294 61.9761 20.4566C61.0516 20.5519 60.1464 20.8552 59.2099 20.8283C58.3335 20.8014 57.4572 20.8332 56.5954 21.1438C56.3016 21.2489 55.9766 21.1951 55.6661 21.2147C54.6381 21.2807 53.5956 21.1535 52.5869 21.5668C52.5388 21.5864 52.4834 21.5742 52.4328 21.5791C50.4226 21.7478 48.4148 21.9116 46.4045 22.0828C45.8388 22.1317 45.2706 22.0681 44.7169 22.3494C44.4858 22.4668 44.2065 22.4178 43.9489 22.4399C42.7139 22.5401 41.4836 22.5817 40.2462 22.792C38.3034 23.1197 36.3341 23.1613 34.3768 23.3422C33.917 23.3838 33.4595 23.4939 32.9997 23.5746C32.848 23.6015 32.6964 23.6504 32.5423 23.665C30.7415 23.8338 28.9383 23.9952 27.1351 24.1664C26.5717 24.2202 25.9964 24.1444 25.4475 24.4378C25.2645 24.5356 25.0406 24.5063 24.8335 24.5259C23.6515 24.6286 22.4694 24.6897 21.2849 24.8756C19.2386 25.1984 17.1657 25.2448 15.1049 25.4233C14.6451 25.4625 14.1877 25.5774 13.7279 25.6483C13.3692 25.7021 13.0104 25.751 12.6517 25.7804C11.5202 25.8758 10.3911 25.9222 9.2596 26.1179C7.82715 26.3624 6.36341 26.3184 4.91411 26.3037C3.21924 26.2866 2.01792 25.037 1.07178 23.2738C0.862328 22.8849 0.739546 22.4154 0.568616 21.9899C0.419352 21.6133 0.530096 21.2929 0.729917 21.0655C0.958627 20.8038 1.21863 20.5422 1.4979 20.4126C2.52108 19.943 3.56111 19.4906 4.65169 19.5444C5.4919 19.586 6.27674 19.1776 7.10491 19.1678C7.93308 19.158 8.78773 19.273 9.58461 19.0455C10.8172 18.6958 12.0619 18.8866 13.2825 18.6494C14.7703 18.3583 16.2605 18.2972 17.7532 18.2459C18.8028 17.7372 19.9054 17.9695 20.9816 17.8644C22.5729 17.7078 24.1546 17.3508 25.758 17.4144C26.8606 16.9131 28.0186 17.2114 29.1357 16.9864C30.5176 16.7076 31.9019 16.6074 33.2934 16.578C34.2371 16.0816 35.2362 16.3017 36.2089 16.2014C37.9037 16.0278 39.5914 15.6928 41.2983 15.7515C42.5068 15.2477 43.7683 15.5607 44.9889 15.3211C46.4767 15.0276 47.967 14.9665 49.462 14.9127C50.5646 14.3967 51.7202 14.5776 52.8469 14.5532C53.6847 14.5361 54.4671 14.1546 55.2953 14.1619C56.1235 14.1717 56.9806 14.2793 57.775 14.0445C59.0076 13.6777 60.2523 13.8953 61.4729 13.6532C63.0113 13.3476 64.5737 13.4723 66.0977 13.1984C67.4892 12.9489 68.8879 13.0712 70.2602 12.8047C71.801 12.5063 73.3634 12.6653 74.8825 12.3596C76.2235 12.0881 77.5669 12.23 78.891 11.983C80.5329 11.6748 82.1988 11.8191 83.8239 11.5257C85.5284 11.22 87.2377 11.445 88.9181 11.1368C90.8224 10.7871 92.746 11.0097 94.631 10.6967C96.2826 10.4203 97.9437 10.6282 99.5664 10.2956C101.524 9.89453 103.481 10.0559 105.433 9.90431C105.532 9.89698 105.628 9.83339 105.725 9.79671C105.597 9.74536 105.469 9.64509 105.342 9.64509C103.011 9.6402 100.669 9.45679 98.3506 9.69645C94.7322 10.0682 91.1065 9.74536 87.4977 10.0951C84.4498 10.391 81.3923 10.1978 78.3565 10.5279C75.8768 10.7994 73.3923 10.6282 70.9246 10.9167C68.9144 11.154 66.8897 11.061 64.8939 11.3471C62.9848 11.6186 61.0757 11.5648 59.1714 11.7091C58.2974 11.7751 57.4307 11.9438 56.5568 12.0172C55.6781 12.0881 54.7777 11.961 53.9207 12.1639C52.688 12.4574 51.453 12.4305 50.218 12.5405C49.3465 12.6188 48.4798 12.8095 47.6058 12.8902C46.7825 12.9661 45.9615 12.9245 45.1454 13.2131C44.7048 13.3696 44.2185 13.2864 43.7515 13.3158C42.8776 13.372 41.9892 13.2473 41.1394 13.6532C41.0912 13.6752 41.0359 13.6704 40.9853 13.6704C39.2736 13.6092 37.5932 14.069 35.8887 14.1595C35.1688 14.1986 34.4394 14.1057 33.7412 14.4725C33.604 14.5434 33.433 14.5043 33.279 14.5165C32.0439 14.6192 30.7969 14.4994 29.5811 14.9224C26.2203 14.9469 22.8763 15.5583 19.5106 15.5094C18.1239 15.4898 16.7372 15.8199 15.3409 15.7979C14.8762 15.7906 14.4068 15.8028 13.9421 15.8542C11.8621 16.0816 10.5452 14.6021 9.56053 12.3694C9.50757 12.252 9.4859 12.1126 9.44257 11.9879C9.21386 11.33 9.37756 10.5695 9.83258 10.2296C9.96499 10.1293 10.1094 10.0462 10.2563 9.99724C11.3011 9.64754 12.3315 9.21469 13.4245 9.16089C14.1949 9.1242 14.9749 9.18779 15.7213 8.80874C15.9066 8.71581 16.1305 8.76472 16.3376 8.75494C17.315 8.70358 18.2997 8.76227 19.2578 8.38322C19.4504 8.30741 19.6695 8.33431 19.8766 8.3392C21.8435 8.39545 23.7743 7.73762 25.7412 7.83299C26.7932 7.36346 27.9007 7.63735 28.9624 7.39769C30.3467 7.08712 31.7526 7.22896 33.1201 6.95506C34.6151 6.65671 36.1174 6.83034 37.5932 6.554C39.1339 6.26299 40.6747 6.22386 42.2203 6.16762C43.3759 5.65162 44.5772 5.88149 45.7569 5.80568C48.3353 5.63939 50.9065 5.27257 53.4921 5.33615C55.5914 4.81771 57.7341 5.20409 59.8262 4.86662C61.8388 4.54381 63.8491 4.64652 65.8569 4.49246C66.5719 4.43866 67.2821 4.23813 67.9996 4.17944C68.8783 4.10852 69.7618 4.14765 70.6406 4.0914C72.1332 3.99603 73.6234 3.83218 75.1161 3.76126C76.6159 3.69034 78.1374 3.87375 79.618 3.6292C82.3 3.18413 85.0011 3.56318 87.6686 3.21103C90.9235 2.78062 94.1784 2.97871 97.4333 2.83198C98.3578 2.7904 99.263 2.48961 100.2 2.49695C102.219 2.51651 104.242 2.37223 106.259 2.44804C107.663 2.50184 109.035 2.1399 110.426 2.13012C115.607 2.08855 120.788 2.04942 125.969 1.99562C126.843 1.98584 127.722 2.12034 128.586 1.7633C128.873 1.64592 129.202 1.72417 129.515 1.72173C134.747 1.67526 139.981 1.63369 145.212 1.57989C145.982 1.57255 146.746 1.58478 147.521 1.37691C148.27 1.17638 149.069 1.29866 149.846 1.29866C157.878 1.29621 165.907 1.29866 173.938 1.29866V1.17149L173.945 1.1666Z" fill="url(#<?php echo esc_attr( $dh_grad ); ?>)" />
								<defs>
									<linearGradient id="<?php echo esc_attr( $dh_grad ); ?>" x1="0.4996" y1="13.1582" x2="235.5" y2="13.1582" gradientUnits="userSpaceOnUse">
										<stop stop-color="#70CDFF" />
										<stop offset="1" stop-color="#68F2D7" />
									</linearGradient>
								</defs>
							</svg>
						<?php endif; ?>
					</span>
				<?php endif; ?>
			</h2>
		<?php endif; ?>

		<?php
		/*
		 * Tab strip. On mobile the same element becomes a scroll-snap slider —
		 * no separate markup, no slider library, so the tab semantics survive
		 * at every breakpoint.
		 */
		?>
		<div class="dh-cases__tabs" data-dh-tabs>
			<div
				class="dh-tablist"
				role="tablist"
				aria-label="<?php esc_attr_e( 'Customer case studies', 'dealhub' ); ?>"
				aria-orientation="horizontal"
			>
				<?php foreach ( $dh_cases as $i => $dh_case ) : ?>
					<?php $dh_selected = 0 === $i; ?>
					<button
						type="button"
						role="tab"
						id="<?php echo esc_attr( "{$dh_uid}-tab-{$i}" ); ?>"
						class="dh-tab<?php echo $dh_selected ? ' is-selected' : ''; ?>"
						aria-controls="<?php echo esc_attr( "{$dh_uid}-panel-{$i}" ); ?>"
						aria-selected="<?php echo $dh_selected ? 'true' : 'false'; ?>"
						tabindex="<?php echo $dh_selected ? '0' : '-1'; ?>"
					>
						<?php
						$dh_logo = dealhub_image(
							$dh_case['tab_logo'],
							'medium',
							array( 'class' => 'dh-tab__logo' ),
							$dh_case['label']
						);

						if ( '' !== $dh_logo ) {
							echo $dh_logo; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built by dealhub_image(), already escaped.
							?>
							<span class="screen-reader-text"><?php echo esc_html( $dh_case['label'] ); ?></span>
							<?php
						} else {
							?>
							<span class="dh-tab__label"><?php echo esc_html( $dh_case['label'] ); ?></span>
							<?php
						}
						?>
					</button>
				<?php endforeach; ?>
			</div>
		</div>

		<div class="dh-cases__panels">
			<?php foreach ( $dh_cases as $i => $dh_case ) : ?>
				<div
					role="tabpanel"
					id="<?php echo esc_attr( "{$dh_uid}-panel-{$i}" ); ?>"
					class="dh-panel<?php echo 0 === $i ? ' is-selected' : ''; ?>"
					aria-labelledby="<?php echo esc_attr( "{$dh_uid}-tab-{$i}" ); ?>"
					tabindex="0"
				>
					<article class="dh-card">

						<figure class="dh-card__quote">
							<?php
							/*
							 * Quote mark from Figma. Painted with `currentColor` rather
							 * than the exported #68F2D7 so the mint stays a single
							 * token — a hard-coded fill here would be the one colour in
							 * the block that retokenising could not reach.
							 */
							?>
							<svg class="dh-card__quote-mark" viewBox="0 0 95 74" fill="none" aria-hidden="true" focusable="false">
								<path fill="currentColor" d="M30.7303 34.4037C37.9739 37.4329 42.364 43.9242 42.364 52.7956C42.364 65.3453 33.3644 73.5676 21.2917 73.5676C8.9996 73.5676 0 65.1289 0 52.7956C0 47.1698 0.878009 43.0587 5.92656 31.158L18.6577 0H40.3884L30.7303 34.4037ZM82.5329 34.4037C89.7765 37.4329 94.1665 43.9242 94.1665 52.7956C94.1665 65.3453 85.1669 73.5676 73.0943 73.5676C60.8022 73.5676 51.8026 65.1289 51.8026 52.7956C51.8026 47.1698 52.6806 43.0587 57.7291 31.158L70.4603 0H92.191L82.5329 34.4037Z" />
							</svg>

							<blockquote class="dh-card__quote-text">
								<p><?php echo nl2br( esc_html( $dh_case['quote'] ) ); ?></p>
							</blockquote>

							<?php if ( '' !== $dh_case['author_name'] || $dh_case['tab_logo'] ) : ?>
								<figcaption class="dh-card__author">
									<?php
									/*
									 * The same logo as the tab. A second "logo in the
									 * card" field only gave editors a way to set two
									 * different marks for one client, or to leave this
									 * one empty and lose it here entirely.
									 */
									echo dealhub_image( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in helper.
										$dh_case['tab_logo'],
										'medium',
										array( 'class' => 'dh-card__author-logo' ),
										$dh_case['label']
									);
									?>

									<span class="dh-card__author-meta">
										<?php if ( '' !== $dh_case['author_name'] ) : ?>
											<span class="dh-card__author-name"><?php echo esc_html( $dh_case['author_name'] ); ?></span>
										<?php endif; ?>

										<?php if ( '' !== $dh_case['author_role'] ) : ?>
											<span class="dh-card__author-role"><?php echo esc_html( $dh_case['author_role'] ); ?></span>
										<?php endif; ?>
									</span>
								</figcaption>
							<?php endif; ?>

							<?php if ( $dh_case['cta'] && ! empty( $dh_case['cta']['url'] ) ) : ?>
								<a
									class="dh-btn"
									href="<?php echo esc_url( $dh_case['cta']['url'] ); ?>"
									<?php if ( ! empty( $dh_case['cta']['target'] ) ) : ?>
										target="<?php echo esc_attr( $dh_case['cta']['target'] ); ?>" rel="noopener"
									<?php endif; ?>
								>
									<span class="dh-btn__label">
										<?php echo esc_html( $dh_case['cta']['title'] ?: __( 'Case Study', 'dealhub' ) ); ?>
									</span>
									<span class="dh-btn__icon" aria-hidden="true">
										<?php // Arrow from Figma; currentColor so the button's colour drives it. ?>
										<svg viewBox="0 0 13 7" fill="none" focusable="false">
											<path d="M0.464233 2.95451C0.207831 2.95451 -2.36332e-05 3.16237 -2.36332e-05 3.41877C-2.36332e-05 3.67517 0.207831 3.88303 0.464233 3.88303V3.41877V2.95451ZM12.8632 3.74705C13.0445 3.56575 13.0445 3.27179 12.8632 3.09049L9.90868 0.135977C9.72738 -0.0453267 9.43343 -0.0453267 9.25212 0.135977C9.07082 0.317281 9.07082 0.611232 9.25212 0.792536L11.8784 3.41877L9.25212 6.045C9.07082 6.22631 9.07082 6.52026 9.25212 6.70156C9.43343 6.88287 9.72738 6.88287 9.90868 6.70156L12.8632 3.74705ZM0.464233 3.41877V3.88303L12.5349 3.88303V3.41877V2.95451L0.464233 2.95451V3.41877Z" fill="currentColor" />
										</svg>
									</span>
									<?php if ( ! empty( $dh_case['cta']['target'] ) ) : ?>
										<span class="screen-reader-text"><?php esc_html_e( '(opens in a new tab)', 'dealhub' ); ?></span>
									<?php endif; ?>
								</a>
							<?php endif; ?>
						</figure>

						<?php
						/*
						 * Facts and video share a container so the card is two
						 * columns — quote | aside — rather than three loose
						 * ones, mirroring the comp's left-box / right-box
						 * split. On mobile the wrapper is `display: contents`
						 * so the stacking order stays quote → video → facts.
						 */
						?>
						<div class="dh-card__aside">

						<div class="dh-card__facts">

							<?php
							/*
							 * The two info boxes share a container; the stats row is
							 * its sibling, not a third box. That is the split the
							 * comp uses, and it lets the boxes stack at the top of
							 * the column while the stats sit at the bottom.
							 */
							?>
							<div class="dh-facts-group">

							<?php if ( ! empty( $dh_case['solutions'] ) ) : ?>
								<div class="dh-facts">
									<?php if ( '' !== $dh_case['solutions_label'] ) : ?>
										<h3 class="dh-facts__label"><?php echo esc_html( $dh_case['solutions_label'] ); ?></h3>
									<?php endif; ?>

									<ul class="dh-facts__list" role="list">
										<?php foreach ( $dh_case['solutions'] as $dh_item ) : ?>
											<li class="dh-facts__item">
												<?php
												echo dealhub_image( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in helper.
													$dh_item['icon'] ?? null,
													'thumbnail',
													array( 'class' => 'dh-facts__icon' ),
													(string) ( $dh_item['label'] ?? '' )
												);
												?>
												<?php if ( ! empty( $dh_item['label'] ) ) : ?>
													<span class="dh-facts__caption"><?php echo esc_html( (string) $dh_item['label'] ); ?></span>
												<?php endif; ?>
											</li>
										<?php endforeach; ?>
									</ul>
								</div>
							<?php endif; ?>

							<?php if ( ! empty( $dh_case['crm_items'] ) ) : ?>
								<div class="dh-facts dh-facts--crm">
									<?php if ( '' !== $dh_case['crm_label'] ) : ?>
										<h3 class="dh-facts__label"><?php echo esc_html( $dh_case['crm_label'] ); ?></h3>
									<?php endif; ?>

									<ul class="dh-facts__list" role="list">
										<?php foreach ( $dh_case['crm_items'] as $dh_item ) : ?>
											<li class="dh-facts__item">
												<?php
												echo dealhub_image( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in helper.
													$dh_item['icon'] ?? null,
													'thumbnail',
													array( 'class' => 'dh-facts__icon' ),
													(string) ( $dh_item['label'] ?? '' )
												);
												?>
												<?php if ( ! empty( $dh_item['label'] ) ) : ?>
													<span class="dh-facts__caption"><?php echo esc_html( (string) $dh_item['label'] ); ?></span>
												<?php endif; ?>
											</li>
										<?php endforeach; ?>
									</ul>
								</div>
							<?php endif; ?>

							</div><!-- .dh-facts-group -->

							<?php if ( ! empty( $dh_case['stats'] ) ) : ?>
								<?php
								/*
								 * role="list" is explicit because the mobile layout sets
								 * `display: contents` on this element to fold the stats
								 * into the shared tile grid, which strips list semantics
								 * in some screen readers.
								 */
								?>
								<ul class="dh-stats" role="list">
									<?php foreach ( $dh_case['stats'] as $dh_stat ) : ?>
										<li class="dh-stats__item">
											<?php if ( ! empty( $dh_stat['value'] ) ) : ?>
												<span class="dh-stats__value"><?php echo esc_html( (string) $dh_stat['value'] ); ?></span>
											<?php endif; ?>
											<?php if ( ! empty( $dh_stat['caption'] ) ) : ?>
												<span class="dh-stats__caption"><?php echo esc_html( (string) $dh_stat['caption'] ); ?></span>
											<?php endif; ?>
										</li>
									<?php endforeach; ?>
								</ul>
							<?php endif; ?>
						</div>

						<?php if ( $dh_case['has_media'] ) : ?>
							<?php
							/*
							 * Facade pattern: only the poster image ships with the page.
							 * The <video> element or provider iframe is injected on the
							 * first press of play, so an unwatched testimonial costs
							 * nothing beyond one image.
							 */
							$dh_video_label = '' !== $dh_case['video_name']
								/* translators: %s: speaker name. */
								? sprintf( __( 'Play the testimonial from %s', 'dealhub' ), $dh_case['video_name'] )
								/* translators: %s: client name. */
								: sprintf( __( 'Play the %s testimonial', 'dealhub' ), $dh_case['label'] );
							?>
							<div
								class="dh-video"
								data-dh-video
								data-video-type="<?php echo esc_attr( $dh_case['video_type'] ); ?>"
								<?php if ( '' !== $dh_case['video_src'] ) : ?>
									data-video-src="<?php echo esc_url( $dh_case['video_src'] ); ?>"
								<?php endif; ?>
								<?php if ( '' !== $dh_case['video_id'] ) : ?>
									data-video-id="<?php echo esc_attr( $dh_case['video_id'] ); ?>"
								<?php endif; ?>
							>
								<div class="dh-video__frame">
									<?php
									// Uploaded poster if there is one, otherwise Wistia's
									// own still, so a row with just a media ID still shows
									// something before playback.
									echo dealhub_video_poster( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in helper.
										$dh_case,
										$dh_video_label
									);
									?>

									<?php if ( $dh_case['has_video'] ) : ?>
										<button type="button" class="dh-video__play" data-dh-video-play>
											<span class="screen-reader-text"><?php echo esc_html( $dh_video_label ); ?></span>
											<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
												<path fill="currentColor" d="M9 6.8v10.4c0 .8.9 1.3 1.6.9l8.3-5.2a1 1 0 0 0 0-1.8l-8.3-5.2A1 1 0 0 0 9 6.8Z" />
											</svg>
										</button>
									<?php endif; ?>

									<?php if ( $dh_case['video_badge'] ) : ?>
										<div class="dh-video__badge">
											<?php
											echo dealhub_image( // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in helper.
												$dh_case['video_badge'],
												'medium',
												array( 'class' => 'dh-video__badge-img' ),
												''
											);
											?>
										</div>
									<?php endif; ?>

									<?php
									/*
									 * No name plate is drawn here. The speaker's
									 * name and title are part of the video artwork
									 * itself, so rendering our own would duplicate
									 * them. `video_name` is still used, but only as
									 * the play button's accessible name.
									 */
									?>
								</div>
							</div>
						<?php endif; ?>

						</div><!-- .dh-card__aside -->

					</article>
				</div>
			<?php endforeach; ?>
		</div>
	</div>
</section>
