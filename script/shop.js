const products = [
  { id:1, title:'FOLLOW GOD - ATELIERS SLEEVE', price:80000, image:'images/p1.jpeg', rating:5 },
  { id:2, title:'FOLLOW GOD - STONED BEANIE', price:40000, image:'images/a1.jpg', rating:4 },
  { id:3, title:'FOLLOW GOD - ANGEL TEE', price:70000, image:'images/p3.jpeg', rating:4.5 },
  { id:4, title:'FOLLOW GOD - RARE ARMLESS TEE', price:60000, image:'images/p4.jpeg', rating:5 },
  { id:5, title:'FOLLOW GOD - SUMMER TEE', price:70000, image:'images/p5.jpeg', rating:4 },
  { id:6, title:'FOLLOW GOD - -234 TEE', price:70000, image:'images/p6.jpeg', rating:4.5 },
  { id:7, title:'FOLLOW GOD - RARE TEE', price:70000, image:'images/p7.jpeg', rating:5 },
  { id:8, title:'FOLLOW GOD - RIDE ON ARMLESS', price:60000, image:'images/p8.jpeg', rating:4 }
];

// Append local shoe images (filenames start with "sho") into the products list
// NOTE: We do not replace the existing `products` array; we push additional items.
(() => {
  const shoImages = [
    'sho1.jpg','sho2.jpg','sho3.jpg','sho4.jpg','sho5.png','sho6.jpg','sho7.jpg','sho8.jpg',
    'sho9.jpg','sho10.jpg','sho11.jpg','sho12.jpg','sho13.jpg','sho14.jpg'
  ];
  let nextId = products.length + 1;
  shoImages.forEach((file, i) => {
    const rating = Math.round((Math.random() * 1 + 4) * 2) / 2; // random 4.0, 4.5, 5.0
    products.push({
      id: nextId + i,
      title: `FOLLOW GOD - SHOES ${i + 1}`,
      price: 70000, // default price for shoes — tweak if needed
      image: `images/${file}`,
      rating
    });
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  // Select the grid container — prefer class (.shop-grid) or fall back to id (#items)
  const shopGrid = document.querySelector('.shop-grid') || document.getElementById('items');
  const sortSelect = document.getElementById('sortSelect');
  // Prefer the topbar cart element specifically
  const cartEl = document.querySelector('.topbar .cart') || document.querySelector('.cart');
  // Cart utilities: prefer the shared window.Cart if available to keep behaviour consistent
  const readCart = (window.Cart && window.Cart.readCart) ? window.Cart.readCart : function(){ try{ return JSON.parse(localStorage.getItem('cart') || '[]'); }catch(e){ return []; } };
  const writeCart = (window.Cart && window.Cart.writeCart) ? window.Cart.writeCart : function(c){ localStorage.setItem('cart', JSON.stringify(c)); };
  const formatPrice = (window.Cart && window.Cart.formatPrice) ? window.Cart.formatPrice : function(n){ return '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  let cartCount = readCart().reduce((s, i) => s + (i.qty || 0), 0);
  // Update topbar badge using shared Cart util if present
  const topbarBadge = (cartEl && (cartEl.querySelector('.notif-badge') || document.querySelector('.topbar .notif-badge'))) || null;
  const cartSummaryTotal = readCart().reduce((s, i) => s + ((i.price || 0) * (i.qty || 0)), 0);
  if(window.Cart && typeof window.Cart.updateTopbarCart === 'function'){
    window.Cart.updateTopbarCart();
  } else {
    if(topbarBadge) topbarBadge.textContent = cartCount;
    if(cartEl) cartEl.setAttribute('title', `${cartCount} ITEM${cartCount > 1 ? 'S' : ''} | ${formatPrice(cartSummaryTotal)}`);
  }

  if(!shopGrid) return; // nothing to render to on this page

  // NOTE: formatPrice is defined above (either from window.Cart or fallback). Use that.

  function renderProducts(list){
    shopGrid.innerHTML = '';
    list.forEach(p => {
      const wrap = document.createElement('div');
      wrap.className = 'product-wrap';
      // Card container — visual card but border will live on .card-content
      const el = document.createElement('article');
      el.className = 'shop-card';
      el.innerHTML = `
        <div class="card-content">
          <img class="thumb" src="${p.image}" alt="${p.title}" />
          <div class="title">${p.title}</div>
          <div class="price">${formatPrice(p.price)}</div>
          <div class="stars" data-rating="${p.rating || 5}" role="img" aria-label="${p.rating || 5} out of 5 stars"></div>
        </div>`;

      // Add a black 'Add to cart' button positioned outside the bordered card
      const addBtn = document.createElement('button');
      addBtn.className = 'btn btn-add';
      addBtn.textContent = 'Add to cart';
      // Click handler: persist to shared cart in localStorage and update UI
      addBtn.addEventListener('click', (e) => {
        // Avoid bubbling to the product card click (which shows a details alert)
        e.preventDefault();
        e.stopPropagation();
        try{ console.debug('Shop: add-to-cart clicked for', p.title); }catch(e){}
        const cart = readCart();
        // Prefer existing product id if present
        const itemId = p.id || Date.now();
        let item = cart.find(i => (i.id && i.id === itemId) || (i.title === p.title && i.image === p.image));
        if(item){ item.qty = (item.qty || 0) + 1; }
        else { item = { id: itemId, title: p.title, price: Number(p.price || 0), qty: 1, image: p.image }; cart.push(item); }
        writeCart(cart);
        // Update topbar immediately. Prefer shared helper but also update DOM directly to guarantee instant feedback.
        if(window.Cart && typeof window.Cart.updateTopbarCart === 'function'){
          try{ window.Cart.updateTopbarCart(); }catch(e){}
        }
        // Direct DOM update (defensive) so current tab sees immediate change even if shared helper fails
        try{
          const newCount = cart.reduce((s, i) => s + (i.qty || 0), 0);
          const newTotal = cart.reduce((s, i) => s + ((i.price || 0) * (i.qty || 0)), 0);
          if(topbarBadge) topbarBadge.textContent = newCount;
          if(cartEl){
            cartEl.setAttribute('title', `${newCount} ITEM${newCount > 1 ? 'S' : ''} | ${formatPrice(newTotal)}`);
            cartEl.setAttribute('aria-label', `Cart — ${newCount} ITEM${newCount > 1 ? 'S' : ''} | ${formatPrice(newTotal)}`);
          }
          try{ console.debug('Shop: topbar updated ->', newCount, formatPrice(newTotal)); }catch(e){}
        }catch(e){ console.error('Shop: failed to update topbar badge', e); }
        addBtn.textContent = 'Added';
        try{ if(window.debugAnimateToCart) console.debug('Shop: animateToCart called for', p.title, el); }catch(e){}
        try{ const imgEl = el.querySelector('.thumb'); if(typeof window.animateToCart === 'function') window.animateToCart(imgEl); }catch(e){}
        setTimeout(()=> addBtn.textContent = 'Add to cart', 1200);
      });
      // Make the whole card cursor pointer and add optional view behavior
      el.setAttribute('tabindex', 0);
      el.addEventListener('click', () => {
        // Simple view behavior: show product details
        alert(p.title + '\n' + formatPrice(p.price));
      });
      // Keyboard accessibility: Enter to view
      el.addEventListener('keydown', (e) => { if(e.key === 'Enter') el.click(); });

      // Insert into wrapper then into grid so button sits outside of the border
      wrap.appendChild(el);
      wrap.appendChild(addBtn);
      shopGrid.appendChild(wrap);

      // Make sure the star element shows the correct percentage based on rating
      try{
        const starEl = el.querySelector('.stars');
        const r = parseFloat(p.rating) || 5;
        const percent = Math.max(0, Math.min(100, (r / 5) * 100));
        if(starEl){
          starEl.style.setProperty('--percent', percent + '%');
          if(typeof window.updateStarRatings === 'function') window.updateStarRatings(el);
        }
      }catch(e){ /* ignore */ }
    });
  }

  // Initial render
  renderProducts(products);

  // Update on storage changes from other tabs (keeps topbar up-to-date)
  window.addEventListener('storage', function(e){
    if(e.key === 'cart'){
      if(window.Cart && typeof window.Cart.updateTopbarCart === 'function'){
        window.Cart.updateTopbarCart();
      } else {
        const cart = readCart();
        const newCount = cart.reduce((s, i) => s + (i.qty || 0), 0);
        const newTotal = cart.reduce((s, i) => s + ((i.price || 0) * (i.qty || 0)), 0);
        if(topbarBadge) topbarBadge.textContent = newCount;
        if(cartEl) cartEl.setAttribute('title', `${newCount} ITEM${newCount > 1 ? 'S' : ''} | ${formatPrice(newTotal)}`);
      }
    }
  });

  // Sorting
  sortSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    const copy = products.slice();
    if(val === 'price-asc') copy.sort((a,b) => a.price - b.price);
    if(val === 'price-desc') copy.sort((a,b) => b.price - a.price);
    renderProducts(copy);
  });

  // Quick focus on search: uses header search with id 'search'
  document.addEventListener('keydown', function(e){
    if(e.key === '/' && document.activeElement.id !== 'search'){
      e.preventDefault(); document.getElementById('search').focus();
    }
  });
});
