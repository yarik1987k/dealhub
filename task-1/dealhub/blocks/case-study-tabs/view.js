/**
 * Case Study Tabs — front-end behaviour.
 *
 * Three concerns, no dependencies:
 *
 *   1. WAI-ARIA tabs with manual activation and a roving tabindex.
 *   2. Below 1024px the tab strip and the panels are both native scroll-snap
 *      carousels that LOOP. Whichever one the finger is on becomes the
 *      "driver"; the other is written to and never read from. That single
 *      rule is the whole design. An earlier version had the two mirroring
 *      each other's scrollLeft and they fought over momentum; a later one
 *      moved the strip with a transform, which meant hand-writing release
 *      physics — velocity, thresholds, wrap timing — that the browser
 *      already does better natively.
 *   3. Video facade: the player is only fetched when someone presses play.
 *
 * Looping uses a clone of the last slide before the first and a clone of the
 * first after the last, so every story has a neighbour on both sides.
 * Settling on a clone jumps to the real slide it stands for. The clones are
 * built in JS, never in the markup, so the document keeps exactly one copy of
 * each story for crawlers and for readers without JavaScript, and they are
 * inert: hidden from assistive tech, unfocusable, and stripped of ids.
 *
 * Loaded only on pages containing the block (declared as `viewScript` in
 * block.json), and deferred by WordPress, so it never blocks rendering.
 */

( function () {
	'use strict';

	/* Must match the carousel breakpoint in style.css. */
	var MOBILE_QUERY = '(max-width: 1023px)';

	function prefersReducedMotion() {
		return window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	}

	/**
	 * Scroll a horizontal scroller so a child sits in its centre.
	 *
	 * Uses bounding rects rather than offsetLeft, which depends on where the
	 * nearest positioned ancestor happens to be, and scrollTo rather than
	 * scrollIntoView, which would also scroll the page vertically.
	 *
	 * @param {HTMLElement} scroller Element with overflow-x.
	 * @param {HTMLElement} child    Child to centre.
	 * @param {boolean}     instant  Skip the smooth animation.
	 */
	function centreIn( scroller, child, instant ) {
		var delta = child.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
		var target = scroller.scrollLeft + delta - ( scroller.clientWidth - child.offsetWidth ) / 2;

		scroller.scrollTo( {
			left: Math.max( 0, target ),
			behavior: ( instant || prefersReducedMotion() ) ? 'auto' : 'smooth'
		} );
	}

	/**
	 * The entry whose element is nearest the scroller's horizontal centre.
	 *
	 * @param {HTMLElement} scroller Element with overflow-x.
	 * @param {Array}       entries  [{ el, index, clone }]
	 * @return {Object} The closest entry.
	 */
	function centredEntry( scroller, entries ) {
		var mid = scroller.getBoundingClientRect().left + scroller.clientWidth / 2;
		var closest = entries[ 0 ];
		var best = Infinity;

		entries.forEach( function ( entry ) {
			var rect = entry.el.getBoundingClientRect();
			var distance = Math.abs( rect.left + rect.width / 2 - mid );

			if ( distance < best ) {
				best = distance;
				closest = entry;
			}
		} );

		return closest;
	}

	/**
	 * Call back once a scroller has settled.
	 *
	 * @param {HTMLElement} scroller Element with overflow-x.
	 * @param {Function}    done     Settle handler.
	 */
	function onSettle( scroller, done ) {
		if ( 'onscrollend' in window ) {
			scroller.addEventListener( 'scrollend', done );
			return;
		}

		var timer = null;

		scroller.addEventListener(
			'scroll',
			function () {
				window.clearTimeout( timer );
				timer = window.setTimeout( done, 120 );
			},
			{ passive: true }
		);
	}

	/**
	 * Make a slide clone inert: no id collisions, no focus, no screen reader.
	 *
	 * @param {HTMLElement} clone Cloned slide.
	 */
	function makeInert( clone ) {
		clone.classList.add( 'dh-clone' );
		clone.setAttribute( 'aria-hidden', 'true' );
		clone.setAttribute( 'tabindex', '-1' );
		clone.removeAttribute( 'id' );

		if ( clone.hasAttribute( 'role' ) ) {
			clone.setAttribute( 'role', 'presentation' );
		}

		// Duplicate ids would break every aria-controls / aria-labelledby
		// pair in the section.
		clone.querySelectorAll( '[id]' ).forEach( function ( el ) {
			el.removeAttribute( 'id' );
		} );

		clone.querySelectorAll( 'a, button, input, select, textarea, iframe, video' ).forEach( function ( el ) {
			el.setAttribute( 'tabindex', '-1' );
		} );
	}

	/* Pending reveal timers, so tearing a video down can cancel its own. */
	var revealTimers = new WeakMap();

	/**
	 * Tear a playing video back down to its poster.
	 *
	 * Removing the element is what actually stops playback — pausing a
	 * <video> leaves an iframe or Wistia player running, and the frame stays
	 * expanded, which drags the whole carousel taller.
	 *
	 * @param {HTMLElement} scope Panel (or any ancestor) to reset within.
	 */
	function resetVideo( scope ) {
		if ( ! scope ) {
			return;
		}

		scope.querySelectorAll( '[data-dh-video].is-playing' ).forEach( function ( wrapper ) {
			/*
			 * Cancel the pending reveal first. Left running it fires after the
			 * teardown and re-adds is-ready, which fades the poster out again
			 * — over an empty frame, since the player has just been removed.
			 */
			window.clearTimeout( revealTimers.get( wrapper ) );
			revealTimers.delete( wrapper );

			var frame = wrapper.querySelector( '.dh-video__frame' );

			if ( frame ) {
				frame.querySelectorAll( 'video, iframe, wistia-player' ).forEach( function ( el ) {
					el.remove();
				} );
			}

			wrapper.classList.remove( 'is-playing', 'is-ready' );
		} );
	}

	/**
	 * Wire up one block instance.
	 *
	 * @param {HTMLElement} root The [data-dh-tabs] wrapper.
	 */
	function initTabs( root ) {
		var list = root.querySelector( '[role="tablist"]' );

		if ( ! list ) {
			return;
		}

		var tabs = Array.prototype.slice.call( list.querySelectorAll( '[role="tab"]' ) );

		if ( tabs.length < 2 ) {
			return;
		}

		var section = root.closest( '.dh-cases' ) || document;
		var panelScroller = section.querySelector( '.dh-cases__panels' );
		var panels = tabs.map( function ( tab ) {
			var id = tab.getAttribute( 'aria-controls' );
			return id ? section.querySelector( '#' + CSS.escape( id ) ) : null;
		} );

		var mobile = window.matchMedia( MOBILE_QUERY );
		var count = tabs.length;

		// Entry lists per scroller, rebuilt whenever clones come and go.
		var tabEntries = [];
		var panelEntries = [];

		var selfScrolling = false;
		var releaseTimer = null;

		/**
		 * Ignore settle events caused by our own programmatic scrolling.
		 *
		 * @param {number} ms How long to ignore settles for.
		 */
		function holdScrollSync( ms ) {
			selfScrolling = true;
			window.clearTimeout( releaseTimer );
			releaseTimer = window.setTimeout( function () {
				selfScrolling = false;
			}, ms || 450 );
		}

		/** A fresh user gesture always outranks a pending programmatic scroll. */
		function releaseScrollSync() {
			window.clearTimeout( releaseTimer );
			selfScrolling = false;
		}

		function selectedIndex() {
			for ( var i = 0; i < count; i++ ) {
				if ( 'true' === tabs[ i ].getAttribute( 'aria-selected' ) ) {
					return i;
				}
			}

			return 0;
		}

		/**
		 * Measure the full-bleed offset for both carousels.
		 *
		 * CSS cannot express "span the viewport" reliably from inside an
		 * arbitrary layout: a negative gutter margin and calc(50% - 50vw) both
		 * assume the container is centred on screen, and asymmetric ancestor
		 * padding then pushes both carousels off-centre together. Measuring
		 * each element's real position removes the assumption.
		 */
		function applyBleed() {
			var viewport = document.documentElement.clientWidth;

			[ root, list, panelScroller ].forEach( function ( el ) {
				if ( ! el ) {
					return;
				}

				if ( ! mobile.matches ) {
					el.style.removeProperty( '--dh-vw' );
					el.style.removeProperty( '--dh-bleed' );
					return;
				}

				el.style.setProperty( '--dh-bleed', '0px' );
				el.style.setProperty( '--dh-vw', viewport + 'px' );
				el.style.setProperty( '--dh-bleed', ( -el.getBoundingClientRect().left ) + 'px' );
			} );
		}

		/**
		 * Add a leading clone of the last slide and a trailing clone of the
		 * first, so every slide has a neighbour on both sides.
		 *
		 * @param {HTMLElement}   scroller Scroll container.
		 * @param {HTMLElement[]} items    Real slides in order.
		 * @return {Array} Entry list including clones.
		 */
		function buildLoop( scroller, items ) {
			var real = items.filter( Boolean );

			if ( ! scroller || real.length < 2 ) {
				return real.map( function ( el, i ) {
					return { el: el, index: i, clone: false };
				} );
			}

			var head = real[ real.length - 1 ].cloneNode( true );
			var tail = real[ 0 ].cloneNode( true );

			makeInert( head );
			makeInert( tail );

			scroller.insertBefore( head, real[ 0 ] );
			scroller.appendChild( tail );

			var entries = [ { el: head, index: real.length - 1, clone: true } ];

			real.forEach( function ( el, i ) {
				entries.push( { el: el, index: i, clone: false } );
			} );

			entries.push( { el: tail, index: 0, clone: true } );

			return entries;
		}

		function destroyLoop( scroller ) {
			if ( ! scroller ) {
				return;
			}

			scroller.querySelectorAll( '.dh-clone' ).forEach( function ( el ) {
				el.remove();
			} );
		}

		/**
		 * Find the entry for a real (non-clone) index.
		 *
		 * @param {Array}  entries Entry list.
		 * @param {number} index   Story index.
		 * @return {Object|null} Matching entry.
		 */
		function realEntry( entries, index ) {
			for ( var i = 0; i < entries.length; i++ ) {
				if ( ! entries[ i ].clone && entries[ i ].index === index ) {
					return entries[ i ];
				}
			}

			return null;
		}

		/**
		 * @param {number} index   Story to select.
		 * @param {Object} options { focus, scroll, instant }
		 */
		function select( index, options ) {
			var opts = options || {};

			tabs.forEach( function ( tab, i ) {
				var isSelected = i === index;
				var panel = panels[ i ];

				tab.setAttribute( 'aria-selected', isSelected ? 'true' : 'false' );
				tab.setAttribute( 'tabindex', isSelected ? '0' : '-1' );
				tab.classList.toggle( 'is-selected', isSelected );

				if ( ! panel ) {
					return;
				}

				/*
				 * Visibility is CSS's job: above the breakpoint only
				 * .is-selected renders, below it every panel is a slide.
				 */
				panel.classList.toggle( 'is-selected', isSelected );

				/*
				 * A slide that is no longer centred goes back to its poster.
				 * Otherwise it keeps playing off-screen and stays at its
				 * expanded height, which makes the carousel — and every other
				 * slide stretched to match it — far too tall.
				 */
				if ( ! isSelected ) {
					resetVideo( panel );
				}
			} );

			// Clones mirror the state of the slide they duplicate, so a
			// centred clone does not look dimmed mid-wrap.
			[ tabEntries, panelEntries ].forEach( function ( entries ) {
				entries.forEach( function ( entry ) {
					if ( entry.clone ) {
						entry.el.classList.toggle( 'is-selected', entry.index === index );
					}
				} );
			} );

			if ( opts.focus ) {
				tabs[ index ].focus();
			}

			if ( opts.scroll && mobile.matches ) {
				holdScrollSync( opts.instant ? 80 : 450 );

				var te = realEntry( tabEntries, index );

				if ( te ) {
					centreIn( list, te.el, opts.instant );
				}

				var pe = panelScroller ? realEntry( panelEntries, index ) : null;

				if ( pe ) {
					centreIn( panelScroller, pe.el, opts.instant );
				}
			}
		}

		/**
		 * Resolve a settled scroll: wrap off a clone, or select what landed.
		 *
		 * @param {HTMLElement} scroller Scroller that settled.
		 * @param {Array}       entries  Its entry list.
		 */
		function handleSettle( scroller, entries ) {
			if ( selfScrolling || ! mobile.matches || ! entries.length ) {
				return;
			}

			var entry = centredEntry( scroller, entries );

			/*
			 * Landed on a clone: jump instantly to the real slide it stands
			 * for. The clone is showing identical content at that moment, so
			 * the jump reads as simply continuing past the end.
			 */
			if ( entry.clone ) {
				holdScrollSync( 80 );

				var target = realEntry( entries, entry.index );

				if ( target ) {
					centreIn( scroller, target.el, true );
				}

				select( entry.index, { scroll: true, instant: true } );
				return;
			}

			select( entry.index, { scroll: true } );
		}

		/*
		 * Driver / passive. Whichever carousel the finger is on drives; the
		 * other is written to and never read from.
		 */
		var driver = null;

		/*
		 * Which scrollers currently have a finger on them. A tap is a
		 * pointerdown with no scroll after it, so settle alone cannot tell us
		 * the gesture is over — see releasePointer below.
		 */
		var pointerOn = new WeakSet();

		/*
		 * When each scroller last moved. A finger leaving the glass does not
		 * end the gesture — momentum carries on — so the claim is only safe to
		 * release once the scrolling has actually stopped.
		 */
		var lastScrollAt = new WeakMap();

		function isScrolling( el ) {
			return Date.now() - ( lastScrollAt.get( el ) || 0 ) < 150;
		}

		function otherOf( el ) {
			return el === list ? panelScroller : list;
		}

		function entriesOf( el ) {
			return el === list ? tabEntries : panelEntries;
		}

		function setDriver( el ) {
			if ( driver === el || ! mobile.matches ) {
				return;
			}

			/*
			 * Restore the outgoing passive before switching. Handing the role
			 * over directly — tap a card, then swipe the tabs — used to leave
			 * the previous passive pinned at scroll-snap-type: none for the
			 * rest of the session, because only clearDriver restored it and
			 * clearDriver never ran for a gesture that did not scroll.
			 */
			restoreSnap();

			driver = el;

			// Snapping on the passive side would fight every value we write.
			var passive = otherOf( el );

			if ( passive ) {
				passive.style.scrollSnapType = 'none';
			}
		}

		/** Give both scrollers their snapping back, whoever last gave it up. */
		function restoreSnap() {
			[ list, panelScroller ].forEach( function ( el ) {
				if ( el ) {
					el.style.scrollSnapType = '';
				}
			} );
		}

		function clearDriver() {
			restoreSnap();
			driver = null;
		}

		/** Map one scroller's position onto the other's range. */
		function follow( from, to ) {
			if ( ! to ) {
				return;
			}

			var fromMax = from.scrollWidth - from.clientWidth;
			var toMax = to.scrollWidth - to.clientWidth;

			if ( fromMax <= 0 || toMax <= 0 ) {
				return;
			}

			to.scrollLeft = ( from.scrollLeft / fromMax ) * toMax;
		}

		function handleScroll( el ) {
			lastScrollAt.set( el, Date.now() );

			if ( ! mobile.matches ) {
				return;
			}

			/*
			 * A scroll on the passive side is normally our own doing, so it is
			 * ignored. But only while a finger is actually on the driver: a tap
			 * claims the role and, with nothing to settle, never gives it back,
			 * and the stale claim then swallowed every scroll from the other
			 * carousel. Tapping play on a card and then swiping the tabs left
			 * the tabs moving on their own with the cards frozen behind them.
			 *
			 * So: the element being scrolled wins unless the driver is still
			 * under a finger.
			 */
			if ( driver && driver !== el ) {
				/*
				 * Still under a finger, or still coasting on momentum after
				 * one: the scroll we are seeing here is the passive side
				 * echoing our own writes, so leave the roles alone. Flipping
				 * them mid-flick is what made the two carousels fight in the
				 * first place.
				 */
				if ( pointerOn.has( driver ) || isScrolling( driver ) ) {
					return;
				}

				setDriver( el );
			}

			// Trackpads and scrollbars scroll without a pointerdown.
			if ( ! driver ) {
				setDriver( el );
			}

			follow( el, otherOf( el ) );

			var entries = entriesOf( el );

			if ( entries.length ) {
				var entry = centredEntry( el, entries );

				if ( entry.index !== selectedIndex() ) {
					select( entry.index, {} );
				}
			}
		}

		[ list, panelScroller ].forEach( function ( el ) {
			if ( ! el ) {
				return;
			}

			function claim() {
				pointerOn.add( el );
				releaseScrollSync();
				setDriver( el );
			}

			/*
			 * The gesture is over. If it never scrolled — a tap on play, on a
			 * tab, anywhere — there will be no settle to release the claim, so
			 * release it here.
			 */
			function releasePointer() {
				pointerOn.delete( el );

				if ( driver === el && ! isScrolling( el ) ) {
					clearDriver();
				}
			}

			el.addEventListener( 'pointerdown', claim, { passive: true } );
			el.addEventListener( 'touchstart', claim, { passive: true } );
			el.addEventListener( 'pointerup', releasePointer, { passive: true } );
			el.addEventListener( 'pointercancel', releasePointer, { passive: true } );
			el.addEventListener( 'touchend', releasePointer, { passive: true } );
			el.addEventListener( 'touchcancel', releasePointer, { passive: true } );

			el.addEventListener(
				'scroll',
				function () {
					handleScroll( el );
				},
				{ passive: true }
			);

			onSettle( el, function () {
				if ( ! mobile.matches || ( driver && driver !== el ) ) {
					return;
				}

				handleSettle( el, entriesOf( el ) );
				clearDriver();
			} );
		} );

		tabs.forEach( function ( tab, i ) {
			tab.addEventListener( 'click', function () {
				select( i, { scroll: true } );
			} );
		} );

		list.addEventListener( 'keydown', function ( event ) {
			var current = selectedIndex();
			var next = null;

			switch ( event.key ) {
				case 'ArrowRight':
					next = ( current + 1 ) % count;
					break;
				case 'ArrowLeft':
					next = ( current - 1 + count ) % count;
					break;
				case 'Home':
					next = 0;
					break;
				case 'End':
					next = count - 1;
					break;
				default:
					return;
			}

			event.preventDefault();
			select( next, { focus: true, scroll: true } );
		} );

		/** Build or tear down the loop for the current breakpoint. */
		function syncLoop() {
			destroyLoop( list );
			destroyLoop( panelScroller );

			if ( mobile.matches ) {
				tabEntries = buildLoop( list, tabs );
				panelEntries = buildLoop( panelScroller, panels );

				// Clicking a cloned tab selects the story it duplicates.
				tabEntries.forEach( function ( entry ) {
					if ( entry.clone ) {
						entry.el.addEventListener( 'click', function () {
							select( entry.index, { scroll: true } );
						} );
					}
				} );
			} else {
				tabEntries = tabs.map( function ( el, i ) {
					return { el: el, index: i, clone: false };
				} );
				panelEntries = panels.filter( Boolean ).map( function ( el, i ) {
					return { el: el, index: i, clone: false };
				} );
			}
		}

		var resizeTimer = null;

		window.addEventListener( 'resize', function () {
			window.clearTimeout( resizeTimer );
			resizeTimer = window.setTimeout( function () {
				applyBleed();
				select( selectedIndex(), { scroll: true, instant: true } );
			}, 150 );
		} );

		mobile.addEventListener( 'change', function () {
			applyBleed();
			syncLoop();
			select( selectedIndex(), { scroll: true, instant: true } );
		} );

		applyBleed();
		syncLoop();
		select( selectedIndex(), { scroll: true, instant: true } );
	}

	/**
	 * Load a script once, no matter how many blocks ask for it.
	 *
	 * @param {string}  src    Script URL.
	 * @param {boolean} module Load as an ES module.
	 * @return {Promise} Resolves when it has loaded.
	 */
	var scriptPromises = {};

	function loadScript( src, module ) {
		if ( scriptPromises[ src ] ) {
			return scriptPromises[ src ];
		}

		scriptPromises[ src ] = new Promise( function ( resolve, reject ) {
			var el = document.createElement( 'script' );

			el.src = src;
			el.async = true;

			if ( module ) {
				el.type = 'module';
			}

			el.onload = resolve;
			el.onerror = reject;
			document.head.appendChild( el );
		} );

		return scriptPromises[ src ];
	}

	/**
	 * Build a Wistia player element and pull its SDK in on demand.
	 *
	 * Two scripts are needed: player.js defines the <wistia-player> custom
	 * element, and embed/<id>.js carries that media's own config. Both are
	 * requested only once the visitor presses play, so the SDK is available
	 * for Wistia's analytics and player integrations without any of it
	 * reaching a reader who never watches.
	 *
	 * @param {string} id Wistia media ID.
	 * @return {HTMLElement} The player element.
	 */
	function createWistiaPlayer( id ) {
		loadScript( 'https://fast.wistia.com/player.js', false );
		loadScript( 'https://fast.wistia.com/embed/' + encodeURIComponent( id ) + '.js', true );

		var player = document.createElement( 'wistia-player' );

		player.setAttribute( 'media-id', id );
		player.setAttribute( 'autoplay', 'true' );
		player.setAttribute( 'player-color', '68f2d7' );

		return player;
	}

	/**
	 * Swap a poster for the real player on first press.
	 *
	 * @param {HTMLElement} wrapper The [data-dh-video] element.
	 */
	function initVideo( wrapper ) {
		var button = wrapper.querySelector( '[data-dh-video-play]' );
		var frame = wrapper.querySelector( '.dh-video__frame' );
		var src = wrapper.getAttribute( 'data-video-src' );
		var mediaId = wrapper.getAttribute( 'data-video-id' );
		var type = wrapper.getAttribute( 'data-video-type' );

		// Cloned slides are decorative duplicates; playing a video inside one
		// would load a second player the reader cannot reach.
		if ( ! button || ! frame || wrapper.closest( '.dh-clone' ) ) {
			return;
		}

		if ( ! src && ! mediaId ) {
			return;
		}

		/*
		 * Tapping the poster starts playback too. The button stays the real
		 * control — it is what keyboard and screen reader users get — but a
		 * pointer landing anywhere on the still forwards to it, which is what
		 * people expect from a video thumbnail.
		 */
		frame.addEventListener( 'click', function ( event ) {
			if ( wrapper.classList.contains( 'is-playing' ) || event.target === button || button.contains( event.target ) ) {
				return;
			}

			button.click();
		} );

		button.addEventListener( 'click', function () {
			var player;

			if ( 'wistia' === type && mediaId ) {
				player = createWistiaPlayer( mediaId );
			} else if ( 'file' === type ) {
				player = document.createElement( 'video' );
				player.src = src;
				player.controls = true;
				player.autoplay = true;
				player.playsInline = true;
				player.preload = 'auto';
			} else {
				player = document.createElement( 'iframe' );
				player.src = src;
				player.title = button.textContent.trim();
				player.loading = 'lazy';
				player.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
				player.setAttribute( 'allowfullscreen', '' );
				player.setAttribute( 'frameborder', '0' );
			}

			frame.appendChild( player );
			wrapper.classList.add( 'is-playing' );

			/*
			 * Reveal the player only once it can actually show something.
			 * The poster sits above it until then, so the frame is never
			 * empty while it expands or while the SDK is still loading.
			 *
			 * Each player type announces readiness differently, and the
			 * timeout is the backstop: a provider that never fires an event
			 * must not leave the poster stuck over a playing video.
			 */
			var reveal = function () {
				// A teardown may have happened while we were waiting.
				if ( ! wrapper.classList.contains( 'is-playing' ) ) {
					return;
				}

				wrapper.classList.add( 'is-ready' );
			};

			if ( 'file' === type ) {
				player.addEventListener( 'playing', reveal, { once: true } );
			} else {
				player.addEventListener( 'load', reveal, { once: true } );
				player.addEventListener( 'play', reveal, { once: true } );
			}

			revealTimers.set( wrapper, window.setTimeout( reveal, 1500 ) );

			// Move focus into the player so keyboard users are not left on a
			// button that has just been removed from the page.
			player.setAttribute( 'tabindex', '-1' );
			player.focus( { preventScroll: true } );
		} );
	}

	function init( scope ) {
		var context = scope || document;

		context.querySelectorAll( '[data-dh-tabs]' ).forEach( initTabs );
		context.querySelectorAll( '[data-dh-video]' ).forEach( initVideo );
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', function () {
			init();
		} );
	} else {
		init();
	}
} )();
