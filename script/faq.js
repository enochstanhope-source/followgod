document.addEventListener('DOMContentLoaded', function(){
  const faqList = document.getElementById('faqList');
  if(!faqList) return; // nothing to do if the list is not present on the page
  const items = faqList.querySelectorAll('.faq-item');

  // Initialize expanded state from aria-expanded attribute
  items.forEach((item, index) => {
    const btn = item.querySelector('.faq-q');
    const panel = item.querySelector('.faq-a');
    // wrap content of panel in an inner wrapper that can animate independently
    if (!panel.querySelector('.faq-a-inner')){
      const inner = document.createElement('div');
      inner.className = 'faq-a-inner';
      // move children into inner
      while(panel.firstChild) inner.appendChild(panel.firstChild);
      panel.appendChild(inner);
    }
    // assign a unique id to the answer panel if it doesn't already have one
    if (!panel.id) panel.id = `faq-a-${index + 1}`;
    // ensure the button points to the panel using aria-controls for accessibility
    btn.setAttribute('aria-controls', panel.id);
    // set the aria-hidden attribute on the panel based on the expanded state
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    panel.setAttribute('aria-hidden', (!expanded).toString());
    // default animating flag
    panel.dataset.animating = 'false';
    if(expanded) {
      item.classList.add('expanded');
      // show full height without an initial animation (use px so later animations have numeric start values)
      const inner = panel.querySelector('.faq-a-inner');
      // ensure inner has expanded padding so measurement includes it
      if(inner) inner.style.padding = '10px 18px';
      panel.style.height = panel.scrollHeight + 'px';
      if(inner) { inner.style.opacity = '1'; inner.style.transform = 'none'; }
    } else {
      panel.style.height = '0px';
    }
    btn.addEventListener('click', () => toggleItem(item));

    // when image content loads inside a panel, recompute heights for currently expanded ones
    const imgs = panel.querySelectorAll('img');
    imgs.forEach(img => img.addEventListener('load', () => {
      if (item.classList.contains('expanded')){
        if (panel.dataset.animating !== 'true') panel.style.height = panel.scrollHeight + 'px';
      }
    }));
  });

  // Capitalize the first alphabetic character in each answer element without affecting markup
  function capitalizeFirstVisibleLetter(el){
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    while(walk.nextNode()){
      const node = walk.currentNode;
      if(!node.nodeValue.trim()) continue; // skip whitespace-only
      // Find first alphabetic character index
      const match = node.nodeValue.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/);
      if(match){
        const i = match.index;
        node.nodeValue = node.nodeValue.slice(0,i) + node.nodeValue.charAt(i).toUpperCase() + node.nodeValue.slice(i+1);
        break; // only change the first occurrence inside the element
      }
    }
  }

  // Run the capitalization on all panels
  items.forEach(i => {
    const panel = i.querySelector('.faq-a');
    capitalizeFirstVisibleLetter(panel);
  });

  function openPanel(panel, item) {
    // guard if an animation is already running on this panel
    if (panel.dataset.animating === 'true') return;
    panel.dataset.animating = 'true';
    const inner = panel.querySelector('.faq-a-inner');
    // measure start and end heights
    const startHeight = panel.getBoundingClientRect().height;
    // ensure inner styles are set to final visible state for measurement
    if(inner){ inner.style.opacity = '0'; inner.style.transform = 'translateY(-6px)'; inner.style.padding = '10px 18px'; }
    // force layout
    const endHeight = (inner ? inner.scrollHeight : panel.scrollHeight);
    const targetHeight = endHeight + 'px';
    // create a composite animation for height and inner fade
    let heightAnim;
    if (panel.animate){
      heightAnim = panel.animate([
        { height: startHeight + 'px' },
        { height: targetHeight }
      ], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    } else {
      // fallback to setting height and relying on CSS transition if animate not supported
      panel.style.height = targetHeight;
    }
    // animate inner content (fade/translate) in parallel
    let innerAnim;
    if(inner){
      if (inner.animate){
        innerAnim = inner.animate([
          { opacity: 0, transform: 'translateY(-6px)' },
          { opacity: 1, transform: 'none' }
        ], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
      } else {
        inner.style.opacity = '1'; inner.style.transform = 'none';
      }
    }
    // when animation finishes, clear inline height (set to auto) so content can grow naturally
    const finalize = () => {
      panel.dataset.animating = 'false';
      // set to auto to allow natural growth
      panel.style.height = 'auto';
      // mark the item expanded so other CSS rules can apply
      const it = item || panel.parentElement;
      if(it) it.classList.add('expanded');
      if(inner){ inner.style.opacity = '1'; inner.style.transform = 'none'; inner.style.padding = ''; }
    };
    if (heightAnim && heightAnim.finished){
      heightAnim.finished.then(finalize).catch(finalize);
    } else if (!heightAnim){
      // estimate end of fallback transition
      setTimeout(finalize, 340);
    }
  }

  function closePanel(panel){
    // guard if an animation is already running on this panel
    if (panel.dataset.animating === 'true') return;
    panel.dataset.animating = 'true';
    const inner = panel.querySelector('.faq-a-inner');
    const item = panel.parentElement;
    const q = item ? item.querySelector('.faq-q') : null;
    // measure current height
    const startHeight = panel.getBoundingClientRect().height;
    // animate inner content out in parallel
    let innerAnim;
    if(inner){
      if (inner.animate){
        innerAnim = inner.animate([
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: 'translateY(-6px)' }
        ], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
      } else {
        inner.style.opacity = '0'; inner.style.transform = 'translateY(-6px)';
      }
    }
    // animate height to 0
    let heightAnim;
    if (panel.animate){
      heightAnim = panel.animate([
        { height: startHeight + 'px' },
        { height: '0px' }
      ], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    } else {
      panel.style.height = startHeight + 'px';
      // force layout then set to 0 to trigger any CSS transition fallback
      panel.getBoundingClientRect();
      panel.style.height = '0px';
    }
    const finalize = () => {
      // After collapse finished, remove expanded class and update accessibility attributes
      if(item){
        item.classList.remove('expanded');
        if(q){ q.setAttribute('aria-expanded', 'false'); }
        panel.setAttribute('aria-hidden', 'true');
      }
      panel.dataset.animating = 'false';
      panel.style.height = '0px';
      if(inner){ inner.style.opacity = '0'; inner.style.transform = 'translateY(-6px)'; }
    };
    if (heightAnim && heightAnim.finished){
      heightAnim.finished.then(finalize).catch(finalize);
    } else {
      setTimeout(finalize, 340);
    }
  }

  // helper: returns a Promise that resolves when the panel finishes its JS animation (polls dataset as fallback)
  function waitForPanelTransition(panel){
    return new Promise((resolve) => {
      if (!panel) return resolve();
      if (panel.dataset.animating === 'false') return resolve();
      // if Web Animations are running, wait for their finished promises
      if (panel.getAnimations){
        const running = panel.getAnimations().filter(a => a.playState === 'running');
        if (running.length){
          Promise.all(running.map(a => a.finished)).then(() => resolve()).catch(() => {
            const t = setInterval(()=>{ if(panel.dataset.animating === 'false'){ clearInterval(t); resolve(); } }, 40);
          });
          return;
        }
      }
      // fallback: poll dataset flag
      const timer = setInterval(()=>{
        if (panel.dataset.animating === 'false'){
          clearInterval(timer);
          resolve();
        }
      }, 40);
    });
  }

  async function toggleItem(item){
    const isExpanded = item.classList.contains('expanded');
    const btn = item.querySelector('.faq-q');
    const panel = item.querySelector('.faq-a');
    // ignore quick repeated clicks on the same panel
    if (panel.dataset.animating === 'true') return;
    // collect currently-expanded panels (excluding the one being toggled if it's expanded)
    const currentlyExpanded = Array.from(items).filter(i => i.classList.contains('expanded'));
    // if the panel is currently expanded, close it and return
    if(isExpanded){
      closePanel(panel);
      return;
    }
    // else, we want to close any currently open panels first
    const panelsToClose = currentlyExpanded.map(i => i.querySelector('.faq-a'));
    // start closing them
    panelsToClose.forEach(p => { if (p && p.dataset.animating !== 'true') closePanel(p); });
    // wait for all closes to finish
    if(panelsToClose.length) await Promise.all(panelsToClose.map(p => waitForPanelTransition(p)));
    // now open the selected item - do NOT add the 'expanded' class yet (to avoid layout jumps)
    btn.setAttribute('aria-expanded', 'true');
    panel.setAttribute('aria-hidden', 'false');
    openPanel(panel, item);
  }

  // Keyboard interactions for accessibility
  faqList.addEventListener('keydown', (e) => {
    const t = e.target;
    if(t.classList && t.classList.contains('faq-q')){
      if(e.key === 'ArrowDown'){
        e.preventDefault();
        const next = t.parentElement.nextElementSibling;
        if(next) next.querySelector('.faq-q').focus();
      }
      if(e.key === 'ArrowUp'){
        e.preventDefault();
        const prev = t.parentElement.previousElementSibling;
        if(prev) prev.querySelector('.faq-q').focus();
      }
    }
  });

  // On window resize, recalculate the height for currently expanded panels
  window.addEventListener('resize', () => {
    items.forEach(i => {
      if (i.classList.contains('expanded')){
        const panel = i.querySelector('.faq-a');
        if (panel.dataset.animating !== 'true'){
          // update to current content height to avoid visual jump
          panel.style.height = panel.scrollHeight + 'px';
          // allow it to become auto after a short delay so it can grow/shrink naturally
          setTimeout(() => { if (panel.dataset.animating !== 'true') panel.style.height = 'auto'; }, 300);
        }
      }
    });
  });

  // When the page is fully loaded (images/fonts ready), ensure any initially-expanded panel shows fully
  window.addEventListener('load', () => {
    items.forEach(i => {
      if(i.classList.contains('expanded')){
        const panel = i.querySelector('.faq-a');
        panel.style.height = 'auto';
      }
    });
  });
});
