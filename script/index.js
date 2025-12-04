document.addEventListener('DOMContentLoaded', function(){
  const search = document.getElementById('search');
  const ctas = Array.from(document.querySelectorAll('.cta'));
  const arrivals = document.querySelector('.product-catalog');

  // Press / to focus search
  document.addEventListener('keydown', function(e){
    const target = e.target;
    if(e.key === '/' && document.activeElement !== search){
      e.preventDefault();
      search.focus();
    }
  });

  // Smooth scroll from CTA(s) to new arrivals; but skip hero CTAs which can be wired to control the hero
  if(ctas.length && arrivals){
    // Only bind the smooth scroll for CTAs that have an href="#" placeholder
    ctas.filter(c => !c.hasAttribute('data-hero-nav') && c.getAttribute('href') === '#').forEach(ctaEl => {
      ctaEl.addEventListener('click', function(e){
        e.preventDefault();
        // Scroll into view then offset by topbar height so the top of the element is not hidden
        arrivals.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(()=>{
          const topbar = document.querySelector('.topbar');
          const h = topbar ? topbar.getBoundingClientRect().height : 0;
          if(h) window.scrollBy({ top: -h - 8, left: 0, behavior: 'smooth' });
        }, 200);
      });
    });
  }
  // CART: Add-to-cart behavior
  const topbarCart = document.querySelector('.topbar .cart');

  function formatPrice(n){ return '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function readCart(){
    try{ return JSON.parse(localStorage.getItem('cart') || '[]'); } catch(e){ return []; }
  }

  function writeCart(cart){ localStorage.setItem('cart', JSON.stringify(cart)); }

  function getCartSummary(){
    const cart = readCart();
    let totalQty = 0, subtotal = 0;
    cart.forEach(i => { totalQty += i.qty; subtotal += (i.price * i.qty); });
    return { totalQty, subtotal };
  }

  function updateTopbarCart(){
    if(!topbarCart) return;
    const { totalQty, subtotal } = getCartSummary();
    // if we have a badge, update count there; otherwise fall back to previous text-only layout
    const badge = topbarCart.querySelector('.notif-badge');
    const label = (totalQty || 0) + ' ITEM' + (totalQty === 1 ? '' : 'S') + ' | ' + formatPrice(subtotal || 0);
    if(badge){
      badge.textContent = (totalQty || 0);
      // Add tooltip for subtotal and items
      topbarCart.setAttribute('title', label);
      topbarCart.setAttribute('aria-label', 'Cart — ' + label);
    } else {
      topbarCart.textContent = label;
    }
  }
  // Expose cart utilities globally for other pages/scripts to use
  window.Cart = {
    readCart: readCart,
    writeCart: writeCart,
    getCartSummary: getCartSummary,
    updateTopbarCart: updateTopbarCart,
    formatPrice: formatPrice
  };

  // Enforce a maximum slides per slider.
  // If there are more than `maxSlides` slides in any `.slider .slides`, remove extras (last-first).
  function limitSlidesInAllSliders(maxSlides = 5){
    const slideGroups = document.querySelectorAll('.slider .slides');
    slideGroups.forEach(group => {
      // Use a loop because NodeList will update when removing children
      let slides = group.querySelectorAll('.slide');
      while(slides.length > maxSlides){
        const last = slides[slides.length - 1];
        if(last) last.remove();
        slides = group.querySelectorAll('.slide');
      }
    });
  }

  // Assign static sizing classes (size-1 biggest -> size-3 smallest) to the three slides in the
  // first visible hero pane so the first image appears largest, second medium, third smallest.
  function assignSizeClassesToAllSliders(){
    const slideGroups = document.querySelectorAll('.hero-right .slides');
    slideGroups.forEach(group => {
      const slides = Array.from(group.querySelectorAll('.slide'));
      // Reset any existing size classes
      slides.forEach(s => s.classList.remove('size-1','size-2','size-3'));
      if(slides.length >= 1) slides[0].classList.add('size-1');
      if(slides.length >= 2) slides[1].classList.add('size-2');
      if(slides.length >= 3) slides[2].classList.add('size-3');
    });
  }

  // Initialize count from localStorage on load
  updateTopbarCart();

  // Initialize star percentage fills based on data-rating attributes
  function updateStarRatings(scope=document){
    const starEls = Array.from(scope.querySelectorAll('.stars'));
    if(!starEls.length) return;
    starEls.forEach(el => {
      const raw = el.dataset.rating;
      const rating = parseFloat(raw);
      if(isNaN(rating)) return; // silently skip
      const percent = Math.max(0, Math.min(100, (rating / 5) * 100));
      el.style.setProperty('--percent', percent + '%');
      // Ensure accessible text exists
      const label = (rating % 1 === 0) ? rating + ' out of 5 stars' : rating + ' out of 5 stars';
      el.setAttribute('aria-label', label);
      el.setAttribute('title', label);
      el.setAttribute('role', 'img');
      // Numeric rating value text to show beside stars
      const display = (Math.round(rating * 10) / 10).toFixed(1);
      // Prefer to update an existing .rating-value or create one
      let rv = el.nextElementSibling;
      if(!rv || !rv.classList || !rv.classList.contains('rating-value')){
        rv = document.createElement('span');
        rv.className = 'rating-value';
        rv.setAttribute('aria-hidden', 'true');
        el.parentNode && el.parentNode.insertBefore(rv, el.nextSibling);
      }
      rv.textContent = display;
    });
  }
  // Expose for dynamic updates (e.g. the shop page when elements are rendered)
  window.updateStarRatings = updateStarRatings;
  // Initialize for any existing DOM elements on load
  updateStarRatings();

  // Animate an image flying to the cart icon
  function animateToCart(imgEl){
    try{
      if(window.debugAnimateToCart) console.debug('animateToCart called', imgEl);
      if(!imgEl) return;
      const cart = document.querySelector('.topbar .cart') || document.querySelector('.cart');
      if(!cart) console.debug('animateToCart: cart element not found, using fallback');
      let startRect = imgEl.getBoundingClientRect();
      // If dimensions are zero (image not loaded or hidden), try to use parent or defaults
      if(!startRect || startRect.width <= 0){
        const p = imgEl.closest('.product-card') || imgEl.closest('.shop-card') || imgEl.parentElement;
        startRect = (p && p.getBoundingClientRect()) || { left: window.innerWidth/2 - 30, top: window.innerHeight/2 - 30, width: 60, height: 60 };
      }
      const endRect = cart ? cart.getBoundingClientRect() : { left: window.innerWidth - 40, top: 20, width: 24, height: 24 };
      // Clone the image
      const clone = imgEl.cloneNode(true);
      clone.classList.add('flying-clone');
      // Debug visibility if clone appears invisible
      // clone.style.outline = '2px solid rgba(255,0,0,0.18)';
      // Set initial style from startRect
      clone.style.width = Math.max(40, startRect.width) + 'px';
      clone.style.height = Math.max(40, startRect.height) + 'px';
      clone.style.left = (startRect.left) + 'px';
      clone.style.top = (startRect.top) + 'px';
      clone.style.opacity = '1';
      // Use fixed position so transforms are relative to viewport
      clone.style.position = 'fixed';
      clone.style.margin = 0;
      document.body.appendChild(clone);

      // Compute translation to cart center
      const startX = startRect.left + startRect.width / 2;
      const startY = startRect.top + startRect.height / 2;
      const endX = endRect.left + endRect.width / 2;
      const endY = endRect.top + endRect.height / 2;
      const translateX = endX - startX;
      const translateY = endY - startY;
      // Normalize duration so movement appears consistent regardless of distance
      const distance = Math.hypot(translateX, translateY);
      // pixels per second - tune to feel natural; 1200px/s is a good start
      const pxPerSec = 1200;
      const minDuration = 0.5;
      const maxDuration = 1.6;
      const computedDuration = Math.min(maxDuration, Math.max(minDuration, distance / pxPerSec));
      // Respect CSS fly easing variable when present
      const rootStyles = getComputedStyle(document.documentElement);
      const easing = rootStyles.getPropertyValue('--fly-easing') || 'cubic-bezier(.22,.8,.28,1)';
      const opacityDuration = Math.max(0.12, computedDuration - 0.06);
      clone.style.transition = `transform ${computedDuration}s ${easing}, opacity ${opacityDuration}s ease`;
      // Slight overshoot then settle scale
      if(window.debugAnimateToCart) console.debug('animateToCart: startRect', startRect, 'endRect', endRect, 'translate', translateX, translateY);
      // Give the browser a moment to paint before animating so the motion feels smoother
      setTimeout(()=>{
        requestAnimationFrame(()=>{
          clone.style.transform = `translate(0px, 0px) scale(1)`;
          clone.style.opacity = '1';
          requestAnimationFrame(()=>{
            clone.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(0.22)`;
            clone.style.opacity = '0.92';
          });
        });
      }, 60);

      // Add pop to cart
      const popped = () => {
        cart.classList.add('cart-pop');
        setTimeout(()=> cart.classList.remove('cart-pop'), 220);
      };

      // When transition ends, remove clone and pop cart
      clone.addEventListener('transitionend', function handler(e){
        clone.removeEventListener('transitionend', handler);
        try{ clone.parentNode && clone.parentNode.removeChild(clone); }catch(e){}
        popped();
        if(window.debugAnimateToCart) console.debug('animateToCart: transitionend', e);
      });
    }catch(e){ /* ignore safely */ }
  }
  window.animateToCart = animateToCart;

  // Add-to-cart on product card click
  const productCards = document.querySelectorAll('.product-card');
  productCards.forEach(card => {
    card.addEventListener('click', function(e){
      // Allow clicking on interactive children (e.g. buttons) in future; for now we handle the card itself
      const titleEl = card.querySelector('.meta .title');
      const priceEl = card.querySelector('.meta .price');
      const imgEl = card.querySelector('img');
      const title = titleEl ? titleEl.textContent.trim() : 'Product';
      const priceText = priceEl ? priceEl.textContent.trim() : '₦0.00';
      // Keep decimal precision and remove thousands separators/symbols
      const price = parseFloat(priceText.replace(/[^0-9\.]/g, '')) || 0;
      const image = imgEl ? imgEl.src : '';

      const cart = readCart();
      // Attempt to find existing product by title and image
      let item = cart.find(i => i.title === title && i.image === image);
      if(item){
        item.qty += 1;
      } else {
        // Use timestamp as quick id
        item = { id: Date.now(), title, price, qty: 1, image };
        cart.push(item);
      }
      writeCart(cart);
      updateTopbarCart();

      // Provide quick visual feedback
      card.classList.add('added-to-cart');
      if(imgEl && typeof window.animateToCart === 'function') {
        if(window.debugAnimateToCart) console.debug('Index: animateToCart called for product card', title);
        window.animateToCart(imgEl);
      }
      setTimeout(() => card.classList.remove('added-to-cart'), 750);
    });
  });

  // Add-to-cart handlers for catalog buttons (product-wrap buttons)
  const catalogAddBtns = document.querySelectorAll('.product-wrap .btn-add');
  catalogAddBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation(); // avoid firing card click handler
      const wrap = btn.closest('.product-wrap');
      if(!wrap) return;
      const card = wrap.querySelector('.product-card');
      if(!card) return;
      const titleEl = card.querySelector('.meta .title');
      const priceEl = card.querySelector('.meta .price');
      const imgEl = card.querySelector('img');
      const title = titleEl ? titleEl.textContent.trim() : 'Product';
      const priceText = priceEl ? priceEl.textContent.trim() : '₦0.00';
      const price = parseFloat(priceText.replace(/[^0-9\.]/g, '')) || 0;
      const image = imgEl ? imgEl.src : '';

      const cart = readCart();
      let item = cart.find(i => i.title === title && i.image === image);
      if(item){ item.qty += 1; }
      else { item = { id: Date.now(), title, price, qty: 1, image }; cart.push(item); }
      writeCart(cart);
      updateTopbarCart();

      // Visual feedback
      card.classList.add('added-to-cart');
      if(imgEl && typeof window.animateToCart === 'function') {
        if(window.debugAnimateToCart) console.debug('Index: animateToCart called for catalog add button', title);
        window.animateToCart(imgEl);
      }
      setTimeout(() => card.classList.remove('added-to-cart'), 750);
      // Update button state briefly
      const oldText = btn.textContent;
      btn.textContent = 'Added';
      setTimeout(()=> btn.textContent = oldText, 1200);
    });
  });

  /* Ensure header is fixed and apply top padding so content isn't hidden */
  function fixTopbarPosition(){
    try{
      const topbar = document.querySelector('.topbar');
      if(!topbar) return;
      // compute the height
      const h = Math.ceil(topbar.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--topbar-height', h + 'px');
      // Apply padding to body so content starts below header
      document.body.style.paddingTop = h + 'px';
    }catch(e){ /* ignore */ }
  }
  window.addEventListener('resize', fixTopbarPosition);
  // set on load
  fixTopbarPosition();

  // Mobile hamburger/off-canvas menu
  function initMobileMenu(){
    const burger = document.getElementById('hamburgerBtn');
    const menu = document.getElementById('mobileMenu');
    const backdrop = document.getElementById('mobileMenuBackdrop');
    const closeBtn = document.getElementById('mobileMenuClose');
    if(!burger || !menu || !backdrop) return;
    // Clone the brand-links and main-nav into the mobile menu for consistency
    try{
      const mobileBrand = menu.querySelector('.mobile-brand-links');
      const desktopBrand = document.querySelector('.brand .brand-links');
      if(mobileBrand && desktopBrand){
        mobileBrand.innerHTML = desktopBrand.innerHTML;
      }
      const mobileMain = menu.querySelector('.mobile-main-nav ul');
      const desktopMain = document.querySelector('.main-nav ul');
      if(mobileMain && desktopMain){
        mobileMain.innerHTML = desktopMain.innerHTML;
      }
    }catch(e){ /* non-blocking */ }

    function openMenu(){
      menu.classList.add('open');
      backdrop.classList.remove('hidden');
      backdrop.classList.add('visible');
      burger.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      document.documentElement.style.setProperty('--scroll-locked', 'hidden');
      document.body.classList.add('no-scroll');
      burger.classList.add('open');
      // For accessibility: focus the first interactive item in the menu
      const firstLink = menu.querySelector('a, button');
      if(firstLink) try{ firstLink.focus({preventScroll:true}); }catch(e){}
    }
    function closeMenu(){
      // animate close by toggling open class off
      menu.classList.remove('open');
      backdrop.classList.remove('visible');
      backdrop.classList.add('hidden');
      burger.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
      burger.classList.remove('open');
      // Return focus to the hamburger button
      try{ burger.focus({preventScroll:true}); }catch(e){}
    }
    burger.addEventListener('click', function(e){
      e.stopPropagation();
      const isOpen = menu.classList.contains('open');
      if(isOpen) closeMenu(); else openMenu();
    });
    // Collections accordion toggle in mobile menu
    try{
      const hasMegaItems = Array.from(menu.querySelectorAll('.mobile-main-nav .has-mega'));
      hasMegaItems.forEach(item => {
        const link = item.querySelector('.collections-link') || item.querySelector('a');
        if(!link) return;
        link.addEventListener('click', function(e){
          e.preventDefault();
          const isOpen = item.classList.contains('open');
          if(isOpen){
            item.classList.remove('open');
          }else{
            item.classList.add('open');
          }
        });
      });
    }catch(e){ /* non-blocking */ }
    backdrop.addEventListener('click', closeMenu);
    if(closeBtn) closeBtn.addEventListener('click', closeMenu);
    // Close menu when a link inside the mobile menu is clicked
    const mobileLinks = Array.from(menu.querySelectorAll('a'));
    mobileLinks.forEach(l => l.addEventListener('click', e => {
      // Allow normal navigation; close in any case
      closeMenu();
    }));
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
    });
  }
  initMobileMenu();

  // If cart is changed in other tab/page, update local topbar too
  window.addEventListener('storage', function(e){
    if(e.key === 'cart') updateTopbarCart();
  });

  // Initialize each pane's internal slider and set the appropriate per-effect animation behavior
  (function initPaneSliders(){
    // Ensure we never have more than 5 slides across any slider on the page
    limitSlidesInAllSliders(5);
    // Assign size classes for the first hero pane's slides
    assignSizeClassesToAllSliders();
    const sliders = Array.from(document.querySelectorAll('.hero-right .slider'));
    // Map pane -> slider control functions (next/prev/setActive). WeakMap so garbage collected with DOM
    const paneSliderMap = new WeakMap();
    if(!sliders.length) return;

    // Helper: keep all slides across a slider and update their active states
    sliders.forEach(slider => {
      const effect = slider.dataset.effect || 'coverflow';
      const slidesWrap = slider.querySelector('.slides');
      // Re-query slides after limiting so the logic below uses the trimmed list
      const slides = Array.from(slidesWrap.querySelectorAll('.slide'));
      // Also ensure that the size classes are assigned after DOM trimming
      assignSizeClassesToAllSliders();
      if(slides.length <= 1) return;

      let currentIndex = 0;
      let dir = 1; // forwards (1) or backwards (-1), used to animate left content
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const intervalMs = 3000;
      let cycleTimer = null;

      function setActive(index){
        index = (index + slides.length) % slides.length;
        slides.forEach((s, i) => {
          s.classList.toggle('active', i === index);
          if(effect === 'coverflow'){
            s.classList.remove('is-prev','is-next','is-off');
            if(i === index) s.classList.add('is-active');
            else if(i === index - 1 || (index === 0 && i === slides.length - 1)) s.classList.add('is-prev');
            else if(i === index + 1 || (index === slides.length - 1 && i === 0)) s.classList.add('is-next');
            else s.classList.add('is-off');
          }
        });
        if(effect === 'l2r'){
          // center the current slide
          const target = slides[index];
          const slideWidth = target.getBoundingClientRect().width;
          const offset = target.offsetLeft - ((slider.clientWidth - slideWidth) / 2);
          slidesWrap.style.transform = `translateX(-${offset}px)`;
        }
        if(effect === 'parallax'){
          // Slight parallax offset for backgrounds
          slides.forEach((s, i) => {
            const y = i === index? -8 : i === index - 1? -3 : 3;
            s.style.transform = `translateY(${y}px) scale(${i === index ? 1.03 : 0.98})`;
          });
        }
        currentIndex = index;
        // update left content for this slide and animate direction-aware classes
        if(typeof updateLeftContent === 'function') updateLeftContent(currentIndex, false, dir);
        // Subtle 'libreath' animate left content and slider on slide change
        try{
          const pane = slider.closest('.hero-pane');
          const paneLeft = pane ? pane.querySelector('.hero-left') : null;
          if(paneLeft){
            paneLeft.classList.remove('animated-in');
            // Force reflow to restart animation
            void paneLeft.offsetWidth;
            paneLeft.classList.add('animated-in');
            setTimeout(()=> paneLeft.classList.remove('animated-in'), 420);
          }
          // Animate slider container slightly
          slidesWrap.classList.remove('animated-in');
          void slidesWrap.offsetWidth;
          slidesWrap.classList.add('animated-in');
          setTimeout(()=> slidesWrap.classList.remove('animated-in'), 420);
        }catch(e){ /* silent */ }
      }

      // Allow external code (e.g. hero pane nav) to request a slide change
      // Listen for a `heropanechange` event dispatched on the pane and reset slider state
      try{
        const paneEl = slider.closest('.hero-pane');
        if(paneEl){
          paneEl.addEventListener('heropanechange', (e) => {
            // When a pane becomes active, reset internal slider to first slide
            setActive(0);
            // Also update left content to reflect the first slide
            updateLeftContent(0, true, 1);
          });
          // Expose our slider controls for other modules to call next/prev
          paneSliderMap.set(paneEl, {
            next: next,
            prev: prev,
            setActive: setActive,
            getIndex: ()=> currentIndex
          });
        }
      }catch(e){ /* ignore */ }

      // Update left content (title, lead, cta) inside the pane based on the current slide
      function updateLeftContent(index, immediate, dirSign){
        const pane = slider.closest('.hero-pane');
        const heroLeft = pane ? pane.querySelector('.hero-left') : null;
        const heroTitle = heroLeft ? heroLeft.querySelector('.brand-title') : null;
        const heroLead = heroLeft ? heroLeft.querySelector('.lead') : null;
        const heroCta = heroLeft ? heroLeft.querySelector('.cta') : null;
        const s = slides[index];
        if(!s || !heroLeft) return;
        const title = s.dataset.title || (heroTitle ? heroTitle.textContent : '');
        const lead = s.dataset.subtext || (heroLead ? heroLead.textContent : '');
        const ctaLabel = s.dataset.ctaLabel || (heroCta ? heroCta.textContent : 'Shop Now');
        if(immediate){
          if(heroTitle) heroTitle.textContent = title;
          if(heroLead) heroLead.textContent = lead;
          if(heroCta) heroCta.textContent = ctaLabel;
          return;
        }
        const clsForward = 'slide-transition-forward';
        const clsBack = 'slide-transition-back';
        if(dirSign === -1){
          heroLeft.classList.add(clsBack);
        } else {
          heroLeft.classList.add(clsForward);
        }
        setTimeout(()=>{
          if(heroTitle) heroTitle.textContent = title;
          if(heroLead) heroLead.textContent = lead;
          if(heroCta) heroCta.textContent = ctaLabel;
          heroLeft.classList.remove(clsForward);
          heroLeft.classList.remove(clsBack);
        }, 250);
      }

      function next(){ dir = 1; setActive(currentIndex + 1); }
      function prev(){ dir = -1; setActive(currentIndex - 1); }

      function startCycle(){ if(prefersReduced) return; cycleTimer = setInterval(next, intervalMs); }
      function stopCycle(){ if(cycleTimer) clearInterval(cycleTimer); cycleTimer = null; }

      // Initialize per-effect layout
      slides.forEach(s => s.classList.remove('active','is-active','is-prev','is-next','is-off'));
      // Immediately populate the left content from the first slide to avoid showing fallback/static text
      try{ updateLeftContent(0, true, dir); }catch(e){ /* ignore if not available */ }
      setActive(0);
      if(slider.dataset.auto === 'true') startCycle();
      // Re-center on resize to ensure coverflow/centered behavior remains consistent
      window.addEventListener('resize', () => setActive(currentIndex));

      // Allow basic swipe/drag to move slides inside a pane
      let pointerActive = false; let startX = 0;
      slidesWrap.addEventListener('pointerdown', e=>{ pointerActive = true; startX = e.clientX; stopCycle(); slidesWrap.setPointerCapture(e.pointerId); }, { passive:true });
      slidesWrap.addEventListener('pointermove', e=>{ if(!pointerActive) return; const dx = e.clientX - startX; if(effect === 'l2r'){
        const target = slides[currentIndex]; const slideWidth = target.getBoundingClientRect().width; const offset = target.offsetLeft - ((slider.clientWidth - slideWidth) / 2);
        slidesWrap.style.transform = `translateX(calc(-${offset}px + ${dx}px))`;
      } }, { passive:true });
      slidesWrap.addEventListener('pointerup', e=>{ if(!pointerActive) return; pointerActive = false; const dx = e.clientX - startX; if(Math.abs(dx) > 30){ if(dx < 0) next(); else prev(); } setActive(currentIndex); if(slider.dataset.auto === 'true') startCycle(); }, { passive:true });
    });
  })();

  // Hero CTA wiring removed (manual hero navigation removed) - no bindings here
  
  // Hero nav removed: programmatic prev/next controls and button wiring deleted per request
  });
  

  // Play/Pause toggle for hero animation (only affects CSS scroller)
  (function initHeroToggle(){
    const hero = document.querySelector('.hero');
    const toggle = document.querySelector('.hero-toggle');
    if(!hero || !toggle) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stored = localStorage.getItem('heroPlaying');
    let isPlaying = stored === null ? true : stored === 'true';
    // If reduced motion prefered, force pause and disable toggle
    if(prefersReduced){
      isPlaying = false;
      toggle.setAttribute('disabled', 'true');
      toggle.setAttribute('aria-pressed', 'true');
      toggle.textContent = 'Play';
    }
    function setPlaying(state){
      isPlaying = !!state;
      if(isPlaying){
        hero.classList.remove('paused');
        toggle.textContent = 'Pause';
        toggle.setAttribute('aria-pressed', 'false');
        localStorage.setItem('heroPlaying','true');
      } else {
        hero.classList.add('paused');
        toggle.textContent = 'Play';
        toggle.setAttribute('aria-pressed', 'true');
        localStorage.setItem('heroPlaying','false');
      }
    }
    // initialize
    setPlaying(isPlaying);
    toggle.addEventListener('click', ()=> setPlaying(!isPlaying));
  })();

    // Logo shake: add a small click / keyboard trigger that toggles the existing CSS animation
    (function initLogoShake(){
      const logo = document.querySelector('.brand .logo');
      if(!logo) return;

      function triggerShake(){
        // restart animation by removing and re-adding the class
        logo.classList.remove('shake');
        void logo.offsetWidth; // force reflow
        logo.classList.add('shake');

        // remove the class once animation completes to keep DOM tidy
        function cleanup(){
          logo.classList.remove('shake');
          logo.removeEventListener('animationend', cleanup);
        }
        logo.addEventListener('animationend', cleanup);

        // remove focus to avoid persistent focus outline in some browsers
        if(document.activeElement === logo) logo.blur();
      }

      // Click to shake
      logo.addEventListener('click', triggerShake);
      // Keyboard activation (Enter / Space)
      logo.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar'){
          e.preventDefault();
          triggerShake();
        }
      });
    // Make the map available for other code if needed (keeps internal pane control mapping)
    })();

  // Highlight current main-nav link by adding `.active` so the nav dot stays visible
  (function markActiveNav(){
    try{
      const mainNav = document.querySelector('.main-nav');
      const navLinks = Array.from(document.querySelectorAll('.main-nav a'));
      if(!navLinks.length) return;

      const loc = window.location;
      function normalizeUrlToKey(urlStr){
        // Resolve relative hrefs against current origin when possible
        try{
          const resolved = new URL(urlStr, loc.href);
          // Normalize index paths to '/'
          let path = resolved.pathname.replace(/\/index\.html$/i, '/');
          // include hash if present
          return path + (resolved.hash || '');
        }catch(e){
          return urlStr || '/';
        }
      }

      const currentKey = (loc.pathname.replace(/\/index\.html$/i, '/') || '/') + (loc.hash || '');

      // Helper to clear existing .active and set one single active link
      function setSingleActive(link){
        navLinks.forEach(l => l.classList.remove('active'));
        if(link) link.classList.add('active');
        // mark the nav container so CSS can decide hover behavior (only one dot at a time)
        if(mainNav) mainNav.classList.toggle('has-active', !!link);
        // ensure moving indicator updates to the active link
        if(typeof moveIndicatorToLink === 'function') moveIndicatorToLink(link, true);
      }

      // First, try to find a link that exactly matches current (path + hash)
      let matched = null;
      for(const a of navLinks){
        const href = a.getAttribute('href') || '';
        const key = normalizeUrlToKey(href);
        if(key === currentKey){ matched = a; break; }
      }

      // if none matched exactly, try matching by pathname only
      if(!matched){
        const currentPath = loc.pathname.replace(/\/index\.html$/i, '/') || '/';
        for(const a of navLinks){
          try{
            const url = new URL(a.getAttribute('href') || '', loc.href);
            const path = url.pathname.replace(/\/index\.html$/i, '/') || '/';
            if(path === currentPath){ matched = a; break; }
          }catch(e){ /* ignore */ }
        }
      }

      setSingleActive(matched);

      // Update on click for in-page navigation (hash links) so the active dot moves immediately
      navLinks.forEach(a => {
        a.addEventListener('click', function(e){
          // If this link navigates within the page (same path but different hash), allow default navigation
          // but still update the active marker immediately for UX
          setSingleActive(a);
        });
      });

      /* ---------- Moving indicator logic ---------- */
      // Create a single dot indicator and animate it between links on hover/click
      let indicator = null;
      function createIndicator(){
        if(!mainNav) return null;
        indicator = mainNav.querySelector('.nav-indicator');
        if(!indicator){
          indicator = document.createElement('div');
          indicator.className = 'nav-indicator';
          mainNav.appendChild(indicator);
        }
        // show via class
        mainNav.classList.add('show-indicator');
        return indicator;
      }

      function getCenterOfLink(link){
        const rect = link.getBoundingClientRect();
        const navRect = mainNav.getBoundingClientRect();
        // center relative to mainNav left
        return (rect.left - navRect.left) + (rect.width / 2);
      }

      function moveIndicatorToLink(link, immediate){
        if(!mainNav) return;
        if(!indicator) createIndicator();
        if(!link){
          // hide indicator if no link
          mainNav.classList.remove('show-indicator');
          return;
        }
        const center = getCenterOfLink(link);
        // set left in pixels; indicator uses translateX(-50%) to center itself
        if(immediate){
          indicator.style.transition = 'none';
          indicator.style.left = center + 'px';
          // force reflow then restore transition
          void indicator.offsetWidth;
          indicator.style.transition = '';
        } else {
          indicator.style.left = center + 'px';
        }
        mainNav.classList.add('show-indicator');
      }

      // initialize indicator and wire hover/mouse events
      createIndicator();
      // We intentionally do NOT move the indicator on hover or focus to
      // satisfy the request to remove hover interactions. The indicator
      // only moves when a link is set active (via click) or on initial load.
      // position indicator to the initially matched active link
      if(matched) moveIndicatorToLink(matched, true);

    }catch(e){ /* silent */ }
  })();

  // Mega menu: collections dropdown (prevent link navigation and enable click toggle on mobile)
  (function initMegaMenu(){
    const menuParents = Array.from(document.querySelectorAll('.main-nav .has-mega'));
    const mainNavEl = document.querySelector('.main-nav');
    if(!menuParents.length) return;

    function closeAll(){
      menuParents.forEach(li => {
        const link = li.querySelector('.collections-link');
        const menu = li.querySelector('.mega-menu');
        if(link) link.setAttribute('aria-expanded','false');
        if(menu) menu.setAttribute('aria-hidden','true');
        li.classList.remove('open');
      });
      if(mainNavEl) mainNavEl.classList.remove('mega-open');
    }

    // Capture clicks on the Collections link; prevent navigation
    menuParents.forEach(li => {
      const link = li.querySelector('.collections-link');
      const menu = li.querySelector('.mega-menu');
      if(!link || !menu) return;
      // keep a per-li close timer so we can delay closing the menu
      let closeTimer = null;

      // Prevent the link from navigating and toggle the menu on click
      link.addEventListener('click', function(e){
        e.preventDefault();
        const open = !li.classList.contains('open');
        closeAll();
        li.classList.toggle('open', open);
        if(mainNavEl) mainNavEl.classList.toggle('mega-open', open);
        link.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu.setAttribute('aria-hidden', open ? 'false' : 'true');
        // clear any pending close operations if opening
        if(open && closeTimer){ clearTimeout(closeTimer); closeTimer = null; }
      });

      // Keep the menu open for 2s when mouse leaves the li area; clear the timer on re-enter
      li.addEventListener('mouseenter', function(){
        if(closeTimer){ clearTimeout(closeTimer); closeTimer = null; }
        li.classList.add('open');
        if(mainNavEl) mainNavEl.classList.add('mega-open');
        link.setAttribute('aria-expanded','true');
        menu.setAttribute('aria-hidden','false');
      });
      li.addEventListener('mouseleave', function(){
        if(closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(function(){
          li.classList.remove('open');
          if(mainNavEl) mainNavEl.classList.remove('mega-open');
          link.setAttribute('aria-expanded','false');
          menu.setAttribute('aria-hidden','true');
          closeTimer = null;
        }, 2000);
      });

      // Keyboard: open on focusin, close after delay on focusout
      li.addEventListener('focusin', function(){ if(closeTimer){ clearTimeout(closeTimer); closeTimer = null; } li.classList.add('open'); link.setAttribute('aria-expanded','true'); menu.setAttribute('aria-hidden','false'); if(mainNavEl) mainNavEl.classList.add('mega-open'); });
      li.addEventListener('focusout', function(){ if(closeTimer) clearTimeout(closeTimer); closeTimer = setTimeout(function(){ li.classList.remove('open'); link.setAttribute('aria-expanded','false'); menu.setAttribute('aria-hidden','true'); if(mainNavEl) mainNavEl.classList.remove('mega-open'); closeTimer = null; }, 2000); });

      // Close when clicking outside
      document.addEventListener('click', function(e){
        if(!li.contains(e.target)){
          li.classList.remove('open');
          link.setAttribute('aria-expanded','false');
          menu.setAttribute('aria-hidden','true');
          if(mainNavEl) mainNavEl.classList.remove('mega-open');
        }
      });

      // Close when pressing Escape
      document.addEventListener('keydown', function(e){
        if(e.key === 'Escape'){
          li.classList.remove('open');
          link.setAttribute('aria-expanded','false');
          menu.setAttribute('aria-hidden','true');
          if(mainNavEl) mainNavEl.classList.remove('mega-open');
        }
      });
    });

    // Add hover behaviour: when the mega menu is open and a different nav link is hovered,
    // close the menu and follow that link automatically.
    try{
      const mainNav = document.querySelector('.main-nav');
      if(mainNav){
        const allNavLinks = Array.from(mainNav.querySelectorAll('a')).filter(a => !a.classList.contains('collections-link'));
        allNavLinks.forEach(a => {
          // Use pointerenter to avoid event bubbling issues with mouseover
          a.addEventListener('pointerenter', function(e){
            // If any mega-menu parent is open, close it (but do NOT follow the hovered link)
            const openMega = mainNav.querySelector('.has-mega.open');
            if(openMega){
              closeAll();
              // We intentionally DO NOT auto-navigate here to avoid accidental page loads on hover.
              // Navigation will only occur on click as usual.
            }
          });
        });
      }
    }catch(e){ /* ignore if something breaks here */ }

    // On window resize, close any open menus (avoid stuck open state)
    window.addEventListener('resize', function(){ closeAll(); });
  })();


