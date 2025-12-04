document.addEventListener('DOMContentLoaded', function(){
  // Toggle returning customer login area
  const loginToggle = document.getElementById('loginToggle');
  const loginContent = document.getElementById('loginContent');
  const couponToggle = document.getElementById('couponToggle');
  const couponContent = document.getElementById('couponContent');
  const couponMessage = document.getElementById('couponMessage');

  if(loginToggle){
    // initialize aria-expanded
    loginToggle.setAttribute('aria-expanded', !loginContent.classList.contains('hidden'));
    loginToggle.addEventListener('click', () => {
    const isHidden = loginContent.classList.toggle('hidden');
    loginToggle.setAttribute('aria-expanded', !isHidden);
    // toggle visual state on `.notice`
    loginToggle.closest('.notice').classList.toggle('open', !isHidden);
    });
  }
  if(couponToggle){
    couponToggle.setAttribute('aria-expanded', !couponContent.classList.contains('hidden'));
    couponToggle.addEventListener('click', () => {
    const isHidden = couponContent.classList.toggle('hidden');
    couponToggle.setAttribute('aria-expanded', !isHidden);
    couponToggle.closest('.notice').classList.toggle('open', !isHidden);
    });
  }

  // Read cart items from localStorage (persisted by index.js)
  // Prefer shared Cart utilities that may exist on other pages; fallback to local storage
  const readCart = (window.Cart && window.Cart.readCart) ? window.Cart.readCart : function(){ try{ return JSON.parse(localStorage.getItem('cart') || '[]'); } catch(e){ return []; } };
  const writeCart = (window.Cart && window.Cart.writeCart) ? window.Cart.writeCart : function(cart){ localStorage.setItem('cart', JSON.stringify(cart)); };
  let cartItems = readCart().map(i => ({ ...i, price: Number(i.price) }));

  const orderItemsNode = document.getElementById('orderItems');
  const totalEl = document.getElementById('orderTotal');

  // Render order items
  function formatPrice(n){ return '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function renderOrder(){
    orderItemsNode.innerHTML = '';
    let subtotal = 0;
    cartItems.forEach(item => {
      const row = document.createElement('div');
      row.className = 'summary-row item';
      row.dataset.id = item.id;
      row.innerHTML = `
        <div class="item-left">
          <img src="${item.image || ''}" alt="" />
          <div class="item-title" title="${item.title}">${item.title}</div>
        </div>
        <div class="item-actions">
          <div class="qty-controls">
            <button class="qty-btn decrease">-</button>
            <span class="qty">${item.qty}</span>
            <button class="qty-btn increase">+</button>
          </div>
          <button class="btn btn-remove remove">Remove</button>
        </div>
        <div class="item-total">${formatPrice(item.price * item.qty)}</div>`;
      orderItemsNode.appendChild(row);
      subtotal += item.price * item.qty;
    });
    // subtotal is intentionally not displayed per UX request
    totalEl.textContent = formatPrice(subtotal); // no shipping/fees for demo

    // Wire up qty and remove
    orderItemsNode.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', function(e){
        const row = e.target.closest('.summary-row');
        const id = Number(row.dataset.id);
        const item = cartItems.find(i => i.id === id);
        if(!item) return;
        if(e.target.classList.contains('increase')){
          item.qty += 1;
        } else if(e.target.classList.contains('decrease')){
          item.qty = Math.max(1, item.qty - 1);
        }
        writeCart(cartItems);
        renderOrder();
      });
    });
    orderItemsNode.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', function(e){
        const row = e.target.closest('.summary-row');
        const id = Number(row.dataset.id);
        cartItems = cartItems.filter(i => i.id !== id);
        writeCart(cartItems);
        renderOrder();
      });
    });
    // Update header/topbar summary
    updateTopbarCart();
    try{ updatePlaceOrderButtonState(); }catch(e){}
  }

  // Update topbar cart (matches index.js format)
  const topbarCart = document.querySelector('.topbar .cart');
  function updateTopbarCart(){
    if(!topbarCart) return;
    let totalQty = 0, subtotal = 0;
    cartItems.forEach(i => { totalQty += i.qty; subtotal += (i.price * i.qty); });
    const label = (totalQty || 0) + ' ITEM' + (totalQty === 1 ? '' : 'S') + ' | ' + formatPrice(subtotal || 0);
    const badge = topbarCart.querySelector('.notif-badge');
    if(badge){
      badge.textContent = (totalQty || 0);
      topbarCart.setAttribute('title', label);
      topbarCart.setAttribute('aria-label', 'Cart — ' + label);
    } else {
      topbarCart.textContent = label;
    }
  }

  renderOrder();
  updateTopbarCart();

  // React to changes from other tabs/windows (when cart is modified elsewhere)
  window.addEventListener('storage', function(e){
    if(e.key === 'cart'){
      cartItems = readCart().map(i => ({ ...i, price: Number(i.price) }));
      renderOrder();
    }
  });

  // Apply coupon
  const applyCouponBtn = document.getElementById('applyCoupon');
  applyCouponBtn && applyCouponBtn.addEventListener('click', function(){
    const code = document.getElementById('couponCode').value.trim();
    if(!code){
      couponMessage.textContent = 'Please enter a coupon code.';
      couponMessage.style.color = '#b00';
      return;
    }
    // Fake coupon: SAVE10 => 10% off
    if(code.toLowerCase() === 'save10'){
      // compute subtotal from cartItems instead of reading removed DOM node
      const curr = cartItems.reduce((sum, i) => sum + (i.price * i.qty), 0);
      const newTotal = Math.round(curr * 0.9);
      totalEl.textContent = formatPrice(newTotal);
      couponMessage.textContent = 'Coupon applied: 10% off';
      couponMessage.style.color = '#0a0';
    } else {
      couponMessage.textContent = 'Coupon not valid';
      couponMessage.style.color = '#b00';
    }
  });

  // Place order (form validation and show success)
  const placeOrderBtn = document.getElementById('placeOrder');
  const orderError = document.getElementById('orderError');
  const orderSuccessModal = document.getElementById('orderSuccessModal');
  const orderSuccessClose = document.getElementById('orderSuccessClose');
  var orderErrorTimeoutId = 0;
  var invoiceGenerated = false; // tracks whether invoice generation completed
  var generatedPdfBlob = null; // stores the PDF Blob after generation
  var generatedPdfUrl = null;  // object URL for the generated PDF blob
  function showOrderError(msg){
    if(!orderError) return;
    // Clear any existing hide timer so repeated clicks keep it visible for 1s
    if(orderErrorTimeoutId) { clearTimeout(orderErrorTimeoutId); orderErrorTimeoutId = 0; }
    orderError.textContent = msg || 'Cart is empty';
    orderError.classList.remove('hidden');
    // Hide after 1 second
    orderErrorTimeoutId = setTimeout(function(){
      hideOrderError();
      orderErrorTimeoutId = 0;
    }, 1000);
  }
  function hideOrderError(){ if(orderError) orderError.classList.add('hidden'); if(orderErrorTimeoutId){ clearTimeout(orderErrorTimeoutId); orderErrorTimeoutId = 0; } }

  function showOrderSuccessModal(){
    if(!orderSuccessModal) return;
    orderSuccessModal.classList.remove('hidden');
    orderSuccessModal.setAttribute('aria-hidden','false');
    try{ orderSuccessClose && orderSuccessClose.focus(); }catch(e){}
  }
  function hideOrderSuccessModal(){
    if(!orderSuccessModal) return;
    orderSuccessModal.classList.add('hidden');
    orderSuccessModal.setAttribute('aria-hidden','true');
  }

  // ------------------------- Shipping form validation -------------------------
  const checkoutForm = document.getElementById('checkoutForm');
  const fullNameEl = checkoutForm ? checkoutForm.querySelector('#fullName') : null;
  const phoneEl = checkoutForm ? checkoutForm.querySelector('#phone') : null;
  // The phone help text element (used to show guidance). We'll hide it once user starts typing numbers.
  const phoneHelpEl = checkoutForm ? checkoutForm.querySelector('#phoneHelp') : null;
  const addressEl = checkoutForm ? checkoutForm.querySelector('#address') : null;

  // Mark required for accessibility and HTML validation hints
  try{ if(fullNameEl) fullNameEl.setAttribute('required','true'); }catch(e){}
  try{ if(phoneEl) phoneEl.setAttribute('required','true'); }catch(e){}
  try{ if(addressEl) addressEl.setAttribute('required','true'); }catch(e){}
  try{ if(fullNameEl) fullNameEl.setAttribute('aria-required','true'); }catch(e){}
  try{ if(phoneEl) phoneEl.setAttribute('aria-required','true'); }catch(e){}
  try{ if(addressEl) addressEl.setAttribute('aria-required','true'); }catch(e){}

  // Wrap inputs in a persistent .input-wrapper on load to avoid moving the actual <input>
  // element when validation icons appear. This prevents focus/caret loss when DOM is
  // updated to add/remove icons (re-parenting the <input> causes the caret to jump).
  function wrapInputInWrapper(input){
    if(!input) return;
    try{
      // If already wrapped, do nothing
      if(input.parentNode && input.parentNode.classList && input.parentNode.classList.contains('input-wrapper')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'input-wrapper';
      // Maintain original input margin spacing — input styles use margin-bottom, but wrapper should hold it
      wrapper.style.marginBottom = getComputedStyle(input).marginBottom || '14px';
      // Mark this wrapper as persistent to avoid unwrap causing reparenting later
      wrapper.dataset.persistent = 'true';
      // Move input into wrapper
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
      // If there were already siblings like help text or tooltip immediately after input (e.g., .form-help), keep them outside the wrapper
      // Nothing else required here; existing code handles inserting errors after wrapper when necessary
    }catch(e){ /* swallow */ }
  }

  // Wrap shipping inputs early so any icons added later won't move the input node
  try{ wrapInputInWrapper(fullNameEl); }catch(e){}
  try{ wrapInputInWrapper(phoneEl); }catch(e){}
  try{ wrapInputInWrapper(addressEl); }catch(e){}

  // Clear field error when user types
  if(fullNameEl) fullNameEl.addEventListener('input', function(){ clearFieldError(fullNameEl); validateFullNameField(); updatePlaceOrderButtonState(); });
  if(phoneEl) {
    // Sanitize input to digits only and validate length exactly 11 digits
    phoneEl.addEventListener('input', function(e){
      try{
        const start = phoneEl.selectionStart || 0;
        const raw = phoneEl.value || '';
        // Keep digits only and enforce maxlength of 11
        const sanitized = raw.replace(/\D/g, '').slice(0, 11);
        if(raw !== sanitized){
          // Determine digits count before cursor in original value
          const beforeCursor = raw.slice(0, start);
          const digitsBefore = (beforeCursor.replace(/\D/g, '')).length;
          phoneEl.value = sanitized;
          // move caret to the nearest position corresponding to the same digits index
          const newPos = Math.min(sanitized.length, digitsBefore);
          phoneEl.setSelectionRange(newPos, newPos);
        }
      }catch(err){}
      clearFieldError(phoneEl);
      // Hide helper once the user enters any digits; show again when empty
      try{
        if(phoneHelpEl){
          if((phoneEl.value || '').length > 0){
            phoneHelpEl.classList.add('hidden');
            // Remove phoneHelp id from aria-describedby if present
            try{
              const desc = phoneEl.getAttribute('aria-describedby');
              if(desc && desc.indexOf('phoneHelp') !== -1){
                const parts = desc.split(/\s+/).filter(Boolean).filter(p => p !== 'phoneHelp');
                if(parts.length) phoneEl.setAttribute('aria-describedby', parts.join(' ')); else phoneEl.removeAttribute('aria-describedby');
              }
            }catch(e){}
          }else{
            phoneHelpEl.classList.remove('hidden');
            // Ensure phoneHelp id is included in aria-describedby
            try{
              const desc = phoneEl.getAttribute('aria-describedby');
              if(!desc || desc.indexOf('phoneHelp') === -1){
                const newDesc = desc ? (desc + ' phoneHelp') : 'phoneHelp';
                phoneEl.setAttribute('aria-describedby', newDesc);
              }
            }catch(e){}
          }
        }
      }catch(err){}
      validatePhoneField();
      updatePlaceOrderButtonState();
    });
    // Prevent non-digit keys
    phoneEl.addEventListener('keydown', function(e){
      const allowed = ['Backspace','ArrowLeft','ArrowRight','Delete','Tab','Home','End'];
      if(allowed.includes(e.key) || e.metaKey || e.ctrlKey) return;
      if(/\d/.test(e.key)){
        // Prevent entering more than 11 digits
        const digits = (phoneEl.value || '').replace(/\D/g, '');
        if(digits.length >= 11){
          e.preventDefault();
        }
        return;
      }
      e.preventDefault();
    });
    // Handle paste - keep digits only and enforce 11-length
    phoneEl.addEventListener('paste', function(e){
      try{
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0,11);
        const start = phoneEl.selectionStart || 0;
        const end = phoneEl.selectionEnd || 0;
        const raw = phoneEl.value || '';
        const beforeDigits = raw.slice(0, start).replace(/\D/g, '');
        const afterDigits = raw.slice(end).replace(/\D/g, '');
        phoneEl.value = (beforeDigits + paste + afterDigits).slice(0,11);
        const newCursor = Math.min(11, (beforeDigits + paste).length);
        phoneEl.setSelectionRange(newCursor, newCursor);
      }catch(e){}
      clearFieldError(phoneEl);
      try{ if(phoneHelpEl){ if((phoneEl.value || '').length > 0) phoneHelpEl.classList.add('hidden'); else phoneHelpEl.classList.remove('hidden'); } }catch(e){}
      validatePhoneField();
    });
    // When user leaves field show an error if it's not 11 digits
    phoneEl.addEventListener('blur', function(){
      const v = (phoneEl.value || '').trim();
      if(v && !validatePhone(v)) showFieldError(phoneEl, 'Please enter an 11-digit phone number');
      // If the value is blank (user erased input), restore helper text
      try{ if(phoneHelpEl){ if(!(phoneEl.value || '').length) phoneHelpEl.classList.remove('hidden'); } }catch(e){}
    });
  }
  if(addressEl) addressEl.addEventListener('input', function(){ clearFieldError(addressEl); validateAddressField(); updatePlaceOrderButtonState(); });
  // Validate full name at start if pre-filled
  try{ if(fullNameEl && fullNameEl.value && fullNameEl.value.trim().length) validateFullNameField(); }catch(e){}
  try{ if(phoneEl && phoneEl.value && phoneEl.value.trim().length){ validatePhoneField(); try{ if(phoneHelpEl) phoneHelpEl.classList.add('hidden'); }catch(e){} } }catch(e){}
  try{ if(addressEl && addressEl.value && addressEl.value.trim().length) validateAddressField(); }catch(e){}

  // Initialize the enabled/disabled state of the Place Order button after initial validations
  try{ updatePlaceOrderButtonState(); }catch(e){}

  function findSiblingByClass(input, cls){
    if(!input) return null;
    let n = input.nextElementSibling;
    while(n){
      try{ if(n.classList && n.classList.contains(cls)) return n; }catch(e){}
      n = n.nextElementSibling;
    }
    // If not found, and the input is inside a wrapper, check the wrapper's next sibling
    try{
      const wrap = (input.parentNode && input.parentNode.classList && input.parentNode.classList.contains('input-wrapper')) ? input.parentNode : null;
      if(wrap){
        let m = wrap.nextElementSibling;
        while(m){
          try{ if(m.classList && m.classList.contains(cls)) return m; }catch(e){}
          m = m.nextElementSibling;
        }
      }
    }catch(e){}
    return null;
  }

  function findAllSiblingsByClass(input, cls){
    const out = [];
    if(!input) return out;
    let n = input.nextElementSibling;
    while(n){
      try{ if(n.classList && n.classList.contains(cls)) out.push(n); }catch(e){}
      n = n.nextElementSibling;
    }
    // Also look for siblings after wrapper if input is inside a wrapper
    try{
      const wrap = (input.parentNode && input.parentNode.classList && input.parentNode.classList.contains('input-wrapper')) ? input.parentNode : null;
      if(wrap){
        let m = wrap.nextElementSibling;
        while(m){
          try{ if(m.classList && m.classList.contains(cls)) out.push(m); }catch(e){}
          m = m.nextElementSibling;
        }
      }
    }catch(e){}
    return out;
  }

  function clearFieldError(input){
    if(!input) return;
    try{ input.removeAttribute('aria-invalid'); }catch(e){}
      const errs = findAllSiblingsByClass(input, 'form-error');
      if(errs && errs.length){
        errs.forEach(err => {
          try{ err.remove(); }catch(e){ try{ err.classList.add('hidden'); }catch(_){} }
        });
        try{
          if(input){
            const orig = input.dataset && input.dataset.origDescribedby;
            if(orig && orig.length){ input.setAttribute('aria-describedby', orig); } else { input.removeAttribute('aria-describedby'); }
            if(input.dataset) delete input.dataset.origDescribedby;
          }
        }catch(e){}
      }
      try{
        // Remove invalid and valid state on wrapper if present
        const wrapper = (input && input.parentNode && input.parentNode.classList && input.parentNode.classList.contains('input-wrapper')) ? input.parentNode : null;
        if(wrapper){
          if(wrapper.classList.contains('invalid')) wrapper.classList.remove('invalid');
          if(wrapper.classList.contains('valid')) wrapper.classList.remove('valid');
        }
      }catch(e){}
  }
  function clearFieldSuccess(input){
    if(!input) return;
    try{ input.classList.remove('valid'); }catch(e){}
      // find the icon(s) and remove them
      // try to find icon inside any wrapper for the input as well
      const wrapper = (input && input.parentNode && input.parentNode.classList && input.parentNode.classList.contains('input-wrapper')) ? input.parentNode : null;
      let succs = findAllSiblingsByClass(input, 'input-success-icon');
      if((!succs || succs.length === 0) && wrapper){
        succs = Array.from(wrapper.querySelectorAll('.input-success-icon'));
      }
      if(succs && succs.length){
        succs.forEach(suc => { try{ suc.remove(); }catch(e){ try{ suc.classList.add('hidden'); }catch(_){} } });
      }
      // If we created an input wrapper earlier, and it contains no success icon anymore, restore the input to its original position
      try{
        if(wrapper){
          const remainingIcons = Array.from(wrapper.querySelectorAll('.input-success-icon'));
          // Only unwrap if there are no success icons left and wrapper only contains the input
          if((!remainingIcons || remainingIcons.length === 0) && wrapper.childElementCount === 1 && !wrapper.dataset.persistent){
            const parent = wrapper.parentNode;
            parent.insertBefore(input, wrapper);
            wrapper.remove();
          }
        }
        // Also ensure invalid and valid state on the wrapper are removed when clearing successes
        try{ if(wrapper && wrapper.classList){ wrapper.classList.remove('invalid'); wrapper.classList.remove('valid'); } }catch(e){}
      }catch(e){}
      // no padding restoration needed because flex layout handles spacing
  }
  function showFieldSuccess(input, msg){
    if(!input) return;
    try{ input.classList.add('valid'); }catch(e){}
    // remove any existing error that might be positioned after the input
    try{ clearFieldError(input); }catch(e){}
    // Ensure a wrapper exists so icon is correctly positioned
    let wrapper = (input && input.parentNode && input.parentNode.classList && input.parentNode.classList.contains('input-wrapper')) ? input.parentNode : null;
    if(!wrapper){
      // create wrapper and move input into it
      wrapper = document.createElement('div');
      wrapper.className = 'input-wrapper';
      try{ input.parentNode.insertBefore(wrapper, input); wrapper.appendChild(input); }catch(e){}
    }
    let suc = findSiblingByClass(input, 'input-success-icon');
    if(!suc){
      // attempt to find inside wrapper as well
      suc = wrapper.querySelector('.input-success-icon');
    }
    if(!suc){
      suc = document.createElement('span');
      suc.className = 'input-success-icon';
      suc.setAttribute('role','img');
      suc.setAttribute('aria-hidden','true');
      // Use an inline SVG checkmark for more consistent horizontal/vertical centering
      suc.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path d="M20.285 6.709a1 1 0 0 0-1.414-1.418L9 15.161l-3.87-3.883a1 1 0 0 0-1.415 1.414l4.577 4.594a1 1 0 0 0 1.415 0L20.285 6.709z" fill="#fff"/></svg>';
      try{ wrapper.style.position = 'relative'; }catch(e){}
      // append icon as the last element in the wrapper - flex layout handles positioning and spacing
      wrapper.appendChild(suc);
    }
    suc.classList.remove('hidden');
    try{ if(wrapper) wrapper.classList.add('valid'); }catch(e){}
    // If general shipping error is showing and this field is the name, hide general error for better UX
    try{ if(input === fullNameEl && orderError && orderError.textContent && orderError.textContent.indexOf('Please check your shipping address details') !== -1){ hideOrderError(); } }catch(e){}
  }
  function showFieldError(input, msg){
    if(!input) return;
    try{ input.setAttribute('aria-invalid', 'true'); }catch(e){}
    // Remove any success that may exist
    try{ clearFieldSuccess(input); }catch(e){}
    let err = findSiblingByClass(input, 'form-error');
    if(!(err && err.classList && err.classList.contains('form-error'))){
      err = document.createElement('span');
      err.className = 'form-error';
      err.style.display = 'block';
      err.style.marginTop = '8px';
      err.style.color = '#b00';
      // If the input is inside a wrapper we created, insert the error after the wrapper to preserve visual layout
      const wrap = (input.parentNode && input.parentNode.classList && input.parentNode.classList.contains('input-wrapper')) ? input.parentNode : null;
      try{
        if(wrap && wrap.parentNode){ wrap.parentNode.insertBefore(err, wrap.nextSibling); } else { input.parentNode.insertBefore(err, input.nextSibling); }
      }catch(e){ try{ input.parentNode.insertBefore(err, input.nextSibling); }catch(_){} }
    }
    err.textContent = msg || 'This field is required';
    err.classList.remove('hidden');
    try{
      if(!err.id) err.id = input.id + '-error';
      if(input){
        const existing = input.getAttribute('aria-describedby');
        if(existing){ input.dataset.origDescribedby = existing; input.setAttribute('aria-describedby', existing + ' ' + err.id); }
        else { input.setAttribute('aria-describedby', err.id); }
      }
    }catch(e){}
    try{
      // Add an invalid class to the wrapper so the border can show as red
      const wrap = (input.parentNode && input.parentNode.classList && input.parentNode.classList.contains('input-wrapper')) ? input.parentNode : null;
      if(wrap && !wrap.classList.contains('invalid')) wrap.classList.add('invalid');
    }catch(e){}
  }

  function validatePhone(value){
    if(!value) return false;
    // Require exactly 11 digits for local Nigerian phone numbers
    const digits = value.replace(/[^0-9]/g, '');
    return digits.length === 11;
  }

  // Full name validation: must contain at least two words with letters
  function validateFullNameField(){
    if(!fullNameEl) return false;
    const v = (fullNameEl.value || '').trim();
    if(!v) { clearFieldSuccess(fullNameEl); return false; }
    const parts = v.split(/\s+/).filter(Boolean);
    const ok = parts.length >= 2 && parts.every(p => /[A-Za-zÁ-ÿ\'\-]{1,}/.test(p));
    if(ok){
      // don't show an error; show success indicator
      clearFieldError(fullNameEl);
      showFieldSuccess(fullNameEl, 'Looks good');
    } else {
      clearFieldSuccess(fullNameEl);
    }
    return ok;
  }

  // Phone validation helper: show success tick when phone format satisfies validatePhone
  function validatePhoneField(){
    if(!phoneEl) return false;
    const v = (phoneEl.value || '').trim();
    if(!v){ clearFieldSuccess(phoneEl); return false; }
    const ok = validatePhone(v);
    if(ok){ clearFieldError(phoneEl); showFieldSuccess(phoneEl); }
    else { clearFieldSuccess(phoneEl); }
    return ok;
  }

  // Address validation: check non-empty and reasonable length (>= 6 characters)
  function validateAddressField(){
    if(!addressEl) return false;
    const v = (addressEl.value || '').trim();
    if(!v){ clearFieldSuccess(addressEl); return false; }
    const ok = v.length >= 6;
    if(ok){ clearFieldError(addressEl); showFieldSuccess(addressEl); }
    else { clearFieldSuccess(addressEl); }
    return ok;
  }

  function validateShippingForm(){
    let valid = true;
    // Clear previous errors
    [fullNameEl, phoneEl, addressEl].forEach(clearFieldError);

    if(!fullNameEl || !fullNameEl.value.trim()){
      showFieldError(fullNameEl, 'Please enter your full name');
      valid = false;
    } else {
      // If the name has only one word, ask for surname specifically
      const parts = (fullNameEl.value || '').trim().split(/\s+/).filter(Boolean);
      if(parts.length < 2){
        showFieldError(fullNameEl, 'Please enter surname or last name');
        valid = false;
      }
    }
    if(!phoneEl || !phoneEl.value.trim() || !validatePhone(phoneEl.value.trim())){
      showFieldError(phoneEl, 'Please enter a valid 11-digit phone number');
      valid = false;
    }
    if(!addressEl || !addressEl.value.trim()){
      showFieldError(addressEl, 'Please enter your delivery address');
      valid = false;
    }

    if(!valid){
      // Show a general error in the order area as well
      showOrderError('Please check your shipping address details');
      // Focus first invalid element for a better UX
      try{ const firstInvalid = document.querySelector('[aria-invalid="true"]'); firstInvalid && firstInvalid.focus(); }catch(e){}
    }else{
      hideOrderError();
    }
    return valid;
  }

  // Update the state of the Place Order button (disabled/enabled) based on
  // shipping form validity and cart contents. This prevents user confusion
  // by disabling the button until both shipping and cart are ready.
  function updatePlaceOrderButtonState(){
    if(!placeOrderBtn) return;
    const fullOk = validateFullNameField();
    const phoneOk = validatePhoneField();
    const addressOk = validateAddressField();
    const enabled = (fullOk && phoneOk && addressOk);
    // Don't actually disable the button here. Keep the button clickable so users
    // can still click "Place Order" to see validation errors (esp. when the
    // cart is empty) — we only disable the button during invoice generation.
    // However keep classes in a sensible state for visual feedback.
    if(!enabled){ placeOrderBtn.classList.remove('success'); placeOrderBtn.classList.remove('processing'); }
    return enabled;
  }

  // Create a function that starts the invoice generation flow to allow invoking it from the WhatsApp modal.
  function startInvoiceGeneration(){
    if(!placeOrderBtn) return;
    console.log('[checkout] startInvoiceGeneration called');
    // Ensure shipping form is valid and cart has items before starting invoice flow
    if(!validateShippingForm()){
      console.log('[checkout] shipping validation failed; aborting invoice generation');
      try{ const firstInvalid = document.querySelector('[aria-invalid="true"]'); firstInvalid && firstInvalid.focus(); }catch(e){}
      return;
    }
    if(!cartItems || cartItems.length === 0){
      showOrderError('Cart is empty');
      try{ placeOrderBtn && placeOrderBtn.focus(); }catch(e){}
      return;
    }
    const originalText = placeOrderBtn.textContent;
    placeOrderBtn.disabled = true;
    placeOrderBtn.textContent = 'Generating invoice...';
    // Apply processing (blue) styling while generating so users know we're processing
    placeOrderBtn.classList.remove('success');
    placeOrderBtn.classList.add('processing');

    // Convert Clear Cart to Cancel Order while generating invoice
    setClearCartToCancelMode();

    setTimeout(function(){
      // Insert payment icon (from icons/payicon.svg) at the start of the button
      // Remove the old receipt emoji and replace with the icon image
      // Keep only the payment icon; avoid adding the 'BUY NOW' label so it cannot reappear as a green button
      placeOrderBtn.innerHTML = '<img src="icons/payicon.svg" alt="" aria-hidden="true" class="whatsapp-icon" width="18" height="18" />';
      // Re-enable button so user can click to go to WhatsApp and mark as whatsapp-ready
      placeOrderBtn.disabled = false;
      placeOrderBtn.setAttribute('data-whatsapp', 'true');
      placeOrderBtn.setAttribute('aria-label', '');
      placeOrderBtn.setAttribute('title', 'Proceed');
      // Switch from processing (blue) to a neutral state (do not apply 'success' green styling)
      placeOrderBtn.classList.remove('processing');
      invoiceGenerated = true;
      console.log('[checkout] invoice marked as generated (ready for PDF/send)');
      try{ createOrderNowButton(); }catch(e){ console.warn('[checkout] failed to create ORDER NOW button', e); }
      // show success modal
      showOrderSuccessModal();
      // After marking the invoice as generated, create the actual PDF in the background
      (async function(){
        try{
          const subtotal = cartItems.reduce((s,i)=> s + i.price*i.qty, 0);
          console.log('[checkout] generating invoice PDF in background');
          const pdfBlob = await generateInvoicePdf(cartItems, subtotal);
          console.log('[checkout] background PDF created, size(bytes):', pdfBlob.size);
          // Revoke old URL if present
          try{ if(generatedPdfUrl){ URL.revokeObjectURL(generatedPdfUrl); generatedPdfUrl = null; } }catch(e){}
          generatedPdfBlob = pdfBlob;
          generatedPdfUrl = URL.createObjectURL(pdfBlob);
          try{ createOrderNowButton(); }catch(e){}
          console.log('[checkout] invoice PDF available at object URL', generatedPdfUrl);
          // Do not auto-download the generated PDF — PDF is stored silently in memory.
          // No UI message shown; PDF stored silently in memory.
          // Remove the BUY NOW / place order button from the UI permanently now that invoice is generated
          try{
            // Hide the place order button instead of removing it so we can restore it on cancel
            if(placeOrderBtn){
              try{ placeOrderBtn.style.display = 'none'; }catch(_){}
            }
          }catch(remErr){ console.warn('[checkout] failed to hide placeOrder button', remErr); }
        }catch(e){ console.error('[checkout] background PDF generation error', e); }
      })();
      // Keep success modal visible briefly then auto close and reset
      setTimeout(function(){
        // no success modal; just clear UI states if desired later
        hideOrderSuccessModal();
        // Reset form and clear cart
        try{ document.getElementById('checkoutForm').reset(); }catch(e){}
        // Do NOT auto-clear the cart; wait for the user to explicitly cancel
        // cartItems = [];
        writeCart(cartItems);
        renderOrder();
        // restore place order button to default
        // Keep button in 'Proceed to WhatsApp' until user cancels or redirects
        // restore place order button to default only if you want to
      }, 3200);
    }, 2500);
  }

  // Create the enabled, shaky ORDER NOW button dynamically after invoice generation.
  function createOrderNowButton(){
    try{
      // Avoid creating duplicate button
      if(document.getElementById('orderNow')) return;
      const container = document.querySelector('.order-summary');
      if(!container) return;
      const btn = document.createElement('button');
      btn.id = 'orderNow';
      btn.type = 'button';
      btn.className = 'btn order-now large shaky';
      // Button starts enabled — clicking shows conversion success (no download/send)
      btn.disabled = false;
      try{ btn.removeAttribute('aria-disabled'); }catch(e){}
      try{ btn.removeAttribute('tabindex'); }catch(e){}
      btn.style.marginTop = '10px';
      btn.textContent = 'ORDER NOW';
      // Insert *before* the Clear Cart button (so ORDER NOW sits above Cancel/Clear Cart).
      const clearBtn = container.querySelector('#clearCart');
      if(clearBtn && clearBtn.parentNode){
        clearBtn.parentNode.insertBefore(btn, clearBtn);
      } else {
        container.appendChild(btn);
      }
      // Hide the Place Order / BUY button completely so no green 'BUY NOW' appears
      try{ if(placeOrderBtn) placeOrderBtn.style.display = 'none'; }catch(e){ }
      // Attach click handler to trigger preparing (generate) the PDF if missing
      try{ attachOrderNowClickHandler(btn); }catch(e){ console.warn('[checkout] failed to attach click handler', e); }
    }catch(e){ console.warn('[checkout] createOrderNowButton error', e); }
  }

  // Attach click handler to the ORDER NOW button so it prepares the generated PDF (remains disabled)
  function attachOrderNowClickHandler(btn){
    if(!btn) return;
    // avoid double attaching
    if(btn._hasClickHandler) return; btn._hasClickHandler = true;
    btn.addEventListener('click', async function(e){
      e.preventDefault();
      // If already sent, abort
      if(btn.getAttribute('data-sent') === 'true') return;
      try{
        btn.disabled = true;
        const prevText = btn.textContent;
        // Do not change button text; leave it unmodified
        // ensure invoice exists
          if(!generatedPdfBlob){
          try{
            const subtotal = cartItems.reduce((s,i)=> s + i.price*i.qty, 0);
            const pdfBlob = await generateInvoicePdf(cartItems, subtotal);
            generatedPdfBlob = pdfBlob;
            generatedPdfUrl = URL.createObjectURL(pdfBlob);
            try{ createOrderNowButton(); }catch(e){}
            try{ if(generatedPdfUrl){ URL.revokeObjectURL(generatedPdfUrl); generatedPdfUrl = null; } }catch(e){}
            generatedPdfUrl = URL.createObjectURL(pdfBlob);
          }catch(err){
            console.error('[checkout] failed to generate PDF on ORDER NOW click', err);
            showOrderError('Failed to prepare invoice');
            btn.disabled = false;
            btn.textContent = prevText;
            return;
          }
        }
        // Do not change button text; leave it unmodified (button remains disabled)
        // No automatic email provider configured; simply store PDF and show converted message
        try{ /* silently store PDF in memory; no UI change */ }catch(e){ console.warn('[checkout] silent storage failed', e); }
        // Notify the user that conversion succeeded (per request). Keep behavior minimal—no download.
          try{ showOrderMessage('PDF converted successfully', true); }catch(e){ console.warn('[checkout] showOrderMessage failed', e); }
          // Show share modal for user to preview / share invoice
          try{ if(generatedPdfUrl) showPdfShareModal && showPdfShareModal(generatedPdfUrl); }catch(e){ console.warn('[checkout] showPdfShareModal failed', e); }
          // Email sending removed: only Telegram sending is attempted.
        // If a Telegram backend is configured, attempt to send the PDF to Telegram now
        if(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID){
          // Prefer direct bot API send if token & chat id configured
          try{
            btn.disabled = true;
            const sendingPrev = btn.textContent;
            btn.textContent = 'Sending to Telegram...';
            const itemsText = cartItems.map(i => `• ${i.qty}x ${i.title}`).join('\n');
            const shippingInfo = (fullNameEl && phoneEl && addressEl) ? `\nShip to:\n${fullNameEl.value}\n${phoneEl.value}\n${addressEl.value}\n` : '';
            const message = `#ORDER REQUEST\nHello! I have placed an order at EMMY STORE with the items listed below:\n${itemsText}\nTotal: ${totalEl.textContent}${shippingInfo}`;
            const telegramCaption = buildWhatsappOrderMessage();
            // Immediately notify user via WhatsApp that the invoice will be sent to Telegram (open in new tab)
            try{ openWhatsAppChat && openWhatsAppChat('2349162919586', buildWhatsappOrderMessage()); }catch(e){ console.warn('[checkout] failed to open WhatsApp link', e); }
            await sendPdfDirectToTelegram(generatedPdfBlob, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, telegramCaption);
            try{ showOrderMessage('Order sent to Telegram', true); }catch(e){}
            try{ btn.setAttribute('data-sent', 'true'); }catch(e){}
            // Automatically clear cart and reset UI after successful send
            try {
              cartItems = [];
              writeCart(cartItems);
              renderOrder();
              // Optionally reset form
              document.getElementById('checkoutForm')?.reset();
              // Revert UI to default buttons/state
              try{ revertToDefaultUI(); }catch(e){}
            } catch(e) { console.warn('[checkout] auto-clear cart failed', e); }
          }catch(teleErr){
            console.error('[checkout] Failed to send invoice via Telegram (direct bot API)', teleErr);
            // If direct send fails and a backend endpoint is configured, try the server fallback
            if(BACKEND_TELEGRAM_ENDPOINT){
              try{
                console.log('[checkout] Direct Telegram upload failed; falling back to backend');
                await sendPdfToTelegram(generatedPdfBlob, null, telegramCaption);
                try{ showOrderMessage('Order sent to Telegram by server', true); }catch(e){}
                try{ btn.setAttribute('data-sent', 'true'); }catch(e){}
                try{ cartItems = []; writeCart(cartItems); renderOrder(); document.getElementById('checkoutForm')?.reset(); }catch(e){ console.warn('[checkout] auto-clear cart failed', e); }
                try{ revertToDefaultUI(); }catch(e){}
              }catch(fbErr){ console.error('[checkout] Telegram backend send also failed', fbErr); }
            }
          }finally{
            try{ btn.disabled = false; }catch(e){}
            try{ btn.textContent = prevText; }catch(e){}
          }
        } else if(BACKEND_TELEGRAM_ENDPOINT){
          try{
            btn.disabled = true;
            const sendingPrev = btn.textContent;
            btn.textContent = 'Sending to Telegram...';
            const itemsText = cartItems.map(i => `• ${i.qty}x ${i.title}`).join('\n');
            const shippingInfo = (fullNameEl && phoneEl && addressEl) ? `\nShip to:\n${fullNameEl.value}\n${phoneEl.value}\n${addressEl.value}\n` : '';
            const message = `#ORDER REQUEST\nHello! I have placed an order at EMMY STORE with the items listed below:\n${itemsText}\nTotal: ${totalEl.textContent}${shippingInfo}`;
            const telegramCaption = buildWhatsappOrderMessage();
            // Immediately notify user via WhatsApp that the invoice will be sent to Telegram (open in new tab)
            try{ openWhatsAppChat && openWhatsAppChat('2349162919586', buildWhatsappOrderMessage()); }catch(e){ console.warn('[checkout] failed to open WhatsApp link', e); }
            await sendPdfToTelegram(generatedPdfBlob, null, telegramCaption);
            try{ showOrderMessage('Order sent to Telegram', true); }catch(e){}
            try{ btn.setAttribute('data-sent', 'true'); }catch(e){}
            try{ cartItems = []; writeCart(cartItems); renderOrder(); document.getElementById('checkoutForm')?.reset(); }catch(e){ console.warn('[checkout] auto-clear cart failed', e); }
            try{ revertToDefaultUI(); }catch(e){}
            // Redirect user to WhatsApp chat after sending the order to Telegram
            try{
              const waNumber = '2349162919586';
              const waMessage = buildWhatsappOrderMessage();
              window.open('https://wa.me/' + waNumber + '?text=' + encodeURIComponent(waMessage), '_blank');
            }catch(e){ console.warn('[checkout] failed to open WhatsApp link', e); }
          }catch(teleErr){
            // Suppress UI error for Telegram send failure but keep console logging.
            console.error('[checkout] Failed to send invoice via Telegram', teleErr);
          }finally{
            try{ btn.disabled = false; }catch(e){}
            try{ btn.textContent = prevText; }catch(e){}
          }
        }
        // Re-enable so users can click again (no downloads or send actions occur)
        try{ btn.disabled = false; }catch(e){}
      }catch(err){
        console.error('[checkout] ORDER NOW send failed', err);
        showOrderError('Failed to send invoice');
        try{ btn.disabled = true; btn.textContent = 'ORDER NOW'; }catch(e){}
      }
    });
  }

  // Enable the ORDER NOW button and make it interactive
  function enableOrderNowButton(){
    try{
      let btn = document.getElementById('orderNow');
      if(!btn){ createOrderNowButton(); btn = document.getElementById('orderNow'); }
      if(!btn) return;
      // Ensure the ORDER NOW button is enabled and interactive
      btn.disabled = false;
      try{ btn.style.cursor = 'pointer'; }catch(e){}
      try{ attachOrderNowClickHandler(btn); }catch(e){}
    }catch(e){ console.warn('[checkout] enableOrderNowButton error', e); }
  }

  // Small helper to show inline messages in the order summary area (success & error)
  function showOrderMessage(message, success){
    try{
      const container = document.querySelector('.order-summary');
      if(!container) return;
      // Use a dedicated element so we don't interfere with existing error UI
      let el = document.getElementById('orderSubmissionInfo');
      if(!el){ el = document.createElement('div'); el.id = 'orderSubmissionInfo'; el.className = success ? 'form-success' : 'form-error'; el.style.marginTop = '10px'; el.role = 'status'; container.appendChild(el); }
      el.textContent = message || '';
      // If success, remove it after a short duration
      if(success){ setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 6000); }
    }catch(e){ console.warn('[checkout] showOrderMessage failed', e); }
  }

  // No download fallback — downloads are suppressed and the PDF remains in memory
  // Removed: download fallback function — downloads have been suppressed per request.

  // ---------------------------------------------------------------------
  // PDF generation and WhatsApp transfer helpers
  // - Tries to use html2canvas + jsPDF (loaded from CDN if necessary)
  // - If a server endpoint is configured, POSTs the generated PDF so the server
  //   can use the WhatsApp Business API to send the file.
  // - Fallbacks:
  //   - If the browser supports the Web Share API with files, it will share with apps
  //   - Otherwise it offers the PDF for download and opens the chat link as fallback
  // ---------------------------------------------------------------------

  // Configure backend endpoint to POST the invoice (server should call WhatsApp Business API)
  // e.g. const BACKEND_WHATSAPP_ENDPOINT = 'https://api.example.com/send-whatsapp-invoice';
  const BACKEND_WHATSAPP_ENDPOINT = '';
  // Backend endpoint to POST the generated PDF so the server can send it via email (Mail-in-a-Box SMTP)
  // For local development with the included mail server use:
  //   http://localhost:3000/send-email
  // If you deploy the mail-server elsewhere, replace with its public URL.
  const BACKEND_EMAIL_ENDPOINT = 'http://localhost:3000/send-email';
  // Backend endpoint to POST the generated PDF so the server can send it via Telegram
  // For local development point this to your server: http://localhost:3000/send-telegram
  const BACKEND_TELEGRAM_ENDPOINT = 'http://localhost:3000/send-telegram';
  // Optionally provide a Telegram Bot token and chat ID if you want the client to
  // call Telegram directly. WARNING: embedding the token in client-side code
  // exposes it publicly. For production, prefer BACKEND_TELEGRAM_ENDPOINT.
  // Replace the placeholders below with your bot token and chat id if desired.
  // Example: const TELEGRAM_BOT_TOKEN = '123456:ABC-DEF...';
  const TELEGRAM_BOT_TOKEN = '7831994291:AAFeWXibZWwDIBeGCZdOUZa5lPvT4goZNVo';
  // Example: const TELEGRAM_CHAT_ID = '123456789';
  const TELEGRAM_CHAT_ID = '5549606687';
  // Third-party email provider support has been removed - no client-side email configuration.

  // Invoice branding constants — change these to your company name and address
  const INVOICE_COMPANY_NAME = 'shopfollowgod.com';
  const INVOICE_COMPANY_ADDRESS = '10 People Street, Computer Village, Lagos, Nigeria';
  const INVOICE_COMPANY_PHONE = '+2349162919586';

  // CDN URLs to load libs if not present
  const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const HTML2CANVAS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

  // Debugging and verification helper removed.

  function loadScript(url){
    return new Promise((resolve, reject) => {
      if(document.querySelector('script[src="' + url + '"]')) return resolve();
      const s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Create a hidden invoice DOM element styled for invoices
  function createInvoiceElement({ items, subtotal, orderTitle = 'Customer Order Alert' }){
    const el = document.createElement('div');
    el.className = 'invoice-export';
    // Inline styles (self-contained) — feel free to adjust to match site branding
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    el.style.top = '0';
    // Increase size for better A4 printing and slightly smaller page padding
    el.style.width = '1122px';
    el.style.padding = '20px';
    el.style.background = '#fff';
    el.style.color = '#222';
    el.style.fontFamily = 'Inter, Arial, Helvetica, sans-serif';
    el.style.boxSizing = 'border-box';
    el.style.fontSize = '14px';
    el.style.lineHeight = '1.4';

    // Add a style block to keep everything self-contained for html2canvas
    const style = document.createElement('style');
    style.textContent = `
      .invoice-body { width: 100%; font-family: 'Roboto', 'Arial', sans-serif; color: #222; }
      .invoice-top { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px; }
      .invoice-logo { width:220px; height:64px; display:flex; align-items:center; }
      .invoice-logo img{ width:220px; height:64px; object-fit:contain; }
      .invoice-title-big{ font-size:50px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:#111; white-space:nowrap; }
      .invoice-title{ white-space:nowrap; }
      .invoice-meta, .invoice-billing { width:48%; }
      .invoice-meta { text-align: right; }
      .invoice-datetime { font-size:12px; color:#444; margin-top:6px; white-space:nowrap;margin-left: 50px }
      .invoice-billing { display:flex; gap:18px; justify-content:space-between; margin-bottom:8px; }
      .bill-box{ width:48%; }
      .bill-title { font-weight:800; font-size:18px; margin-bottom:8px; }
      .bill-lines { font-size:13px; color:#444; line-height:1.35; }

      /* Table styling to mirror the template: pink header and rows separated with borders */
      .invoice-table { width:100%; border-collapse:collapse; margin-top:10px; }
      .invoice-table thead th { background: #f9d6d9; color:#111; font-weight:700; padding:12px 10px; border:1px solid #dcd6d6; }
      .invoice-table tbody td { border:1px solid #eaeaea; padding:10px; font-size:13px; }
      .invoice-table tbody tr.empty td { height:22px; }
      .invoice-table .item-col { width:12%; }
      .invoice-table .desc-col { width:52%; }
      .invoice-table .qty-col { width:8%; text-align:center; }
      .invoice-table .unit-col { width:14%; text-align:right; }
      .invoice-table .amount-col { width:14%; text-align:right; }

      .invoice-total-row td { border: none; border-top: 2px solid #dcd6d6; font-weight:800; }
      .invoice-total-row .label { text-align:right; padding-right:20px; }
      .invoice-total-row .value { text-align:right; padding-right:12px; background:#f9d6d9; }

      .invoice-footer { display:flex; justify-content:space-between; margin-top:20px; gap:16px; }
      .payment-method, .terms-conditions { width:48%; font-size:13px; color:#444; }
      .note-sign { display:flex; justify-content:space-between; align-items:flex-end; margin-top:22px; gap:18px; }
      .note { width:60%; }
      .signature { width:36%; text-align:center; }
      .signature .line{ border-top:1px solid #333; margin-top:40px; }
      .muted { color:#666; font-size:12px; }
      /* Order details spacing for improved PDF readability */
      .invoice-order-details { margin-top:12px; margin-bottom:18px; line-height:1.6; font-size:13px; }
      .invoice-order-details .od-row { display:flex; gap:12px; align-items:flex-start; margin-bottom:10px; }
      .invoice-order-details .od-label { font-weight:800; min-width:160px; text-transform:uppercase; letter-spacing:0.6px; }
      .invoice-order-details .od-value { flex:1; color:#222; }
      .invoice-order-note { font-size:20px; font-weight:700; margin-top:18px; color:#111; white-space: pre-wrap; }
    `;
    el.appendChild(style);

    const container = document.createElement('div');
    container.className = 'invoice-body';

    // Header - logo and title/meta
    const header = document.createElement('div');
    header.className = 'invoice-header';
    const logo = document.createElement('div');
    logo.className = 'invoice-logo';
    // Use an image file for the logo instead of text
    const logoImg = document.createElement('img');
    // Path is relative to the HTML file that will contain the generated invoice
    logoImg.src = 'images/logo.jpg';
    logoImg.alt = INVOICE_COMPANY_NAME || 'Company';
    logo.appendChild(logoImg);
    // centered company area
    const center = document.createElement('div');
    center.className = 'invoice-company-centered';
    const companyNameEl = document.createElement('div');
    companyNameEl.className = 'invoice-title';
    companyNameEl.textContent = INVOICE_COMPANY_NAME;
    const companyTag = document.createElement('div');
    companyTag.className = 'invoice-subtitle';
    companyTag.style.fontWeight = '700';
    companyTag.textContent = INVOICE_COMPANY_ADDRESS;
    const badge = document.createElement('div');
    badge.className = 'cash-badge';
    badge.textContent = 'CASH INVOICE';
    center.appendChild(companyNameEl);
    center.appendChild(companyTag);
    center.appendChild(badge);
    // metaRight container for receipt no / date info
    const metaRight = document.createElement('div');
    metaRight.className = 'invoice-meta';
    const title = document.createElement('div');
    title.className = 'invoice-title-big';
    title.textContent = orderTitle || 'Invoice';
    // Omit sender/company details from the header for exported PDF.
    metaRight.appendChild(title);
    // Append order date/time in top-right for reference
    const now = new Date();
    const dateEl = document.createElement('div');
    dateEl.className = 'invoice-datetime';
    dateEl.textContent = 'Date: ' + now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
    metaRight.appendChild(dateEl);
    // NOTE: Shipping metadata is appended to the Invoice body later as a dedicated '#ORDER DETAILS' section.

    header.appendChild(logo);
    header.appendChild(center);
    header.appendChild(metaRight);
    container.appendChild(header);

    // Order Details: place shipping info near the top of the invoice (replaces
    // the previous Bill To / From block so we don't duplicate invoice meta)
    const orderDetails = document.createElement('div');
    orderDetails.className = 'invoice-order-details';
    orderDetails.innerHTML = `
      <div style="font-weight:700; margin-bottom:8px;">#ORDER  FROM:</div>
      <div class="od-row"><div class="od-label">Name:</div><div class="od-value">${fullNameEl && fullNameEl.value ? fullNameEl.value : ''}</div></div>
      <div class="od-row"><div class="od-label">Phone Number:</div><div class="od-value">${phoneEl && phoneEl.value ? phoneEl.value : ''}</div></div>
      <div class="od-row"><div class="od-label">Receiver's Address:</div><div class="od-value">${addressEl && addressEl.value ? addressEl.value : ''}</div></div>
    `;
    container.appendChild(orderDetails);

    // Build items table with headers matching the requested template
    const table = document.createElement('table');
    table.className = 'invoice-table';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th class='item-col'>Item</th><th class='desc-col'>Description</th><th class='qty-col'>Qty</th><th class='unit-col'>Unit Price</th><th class='amount-col'>Amount</th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    let calcSubtotal = 0;
    const paramItems = items || [];
    // Create rows for items
    paramItems.forEach((i, idx) => {
      const tr = document.createElement('tr');
      const itemTd = document.createElement('td'); itemTd.className = 'item-col'; itemTd.textContent = String(idx + 1);
      const descTd = document.createElement('td'); descTd.className = 'desc-col'; descTd.innerHTML = `<div style="font-weight:700">${i.title}</div><div style="font-size:12px;color:#666">${i.description ? i.description : ''}</div>`;
      const qtyTd = document.createElement('td'); qtyTd.className = 'qty-col'; qtyTd.textContent = String(i.qty || 0);
      const unitTd = document.createElement('td'); unitTd.className = 'unit-col'; unitTd.textContent = formatPrice(i.price || 0);
      const amount = (i.price || 0) * (i.qty || 0);
      const amountTd = document.createElement('td'); amountTd.className = 'amount-col'; amountTd.textContent = formatPrice(amount || 0);
      calcSubtotal += amount;
      tr.appendChild(itemTd);
      tr.appendChild(descTd);
      tr.appendChild(qtyTd);
      tr.appendChild(unitTd);
      tr.appendChild(amountTd);
      tbody.appendChild(tr);
    });
    // Fill with empty rows to reach minimum appearance
    const minRows = 18;
    if(paramItems.length < minRows){
      for(let i = paramItems.length; i < minRows; i++){
        const tr = document.createElement('tr'); tr.className = 'empty';
        tr.innerHTML = `<td class='item-col'>&nbsp;</td><td class='desc-col'>&nbsp;</td><td class='qty-col'>&nbsp;</td><td class='unit-col'>&nbsp;</td><td class='amount-col'>&nbsp;</td>`;
        tbody.appendChild(tr);
      }
    }
    table.appendChild(tbody);
    // Totals (tfoot)
    const tfoot = document.createElement('tfoot');
    const tfootRow = document.createElement('tr'); tfootRow.className = 'invoice-total-row';
    tfootRow.innerHTML = `<td colspan='3'></td><td class='label'>Total:</td><td class='value'>${formatPrice((typeof subtotal === 'number' && !isNaN(subtotal)) ? subtotal : calcSubtotal)}</td>`;
    tfoot.appendChild(tfootRow);
    table.appendChild(tfoot);
    // Use either passed subtotal or calcSubtotal as the display total
    const displayTotal = (typeof subtotal === 'number' && !isNaN(subtotal)) ? subtotal : calcSubtotal;

    // Number to words (simple converter for integer portion)
    function numberToWords(num){
      if(num === 0) return 'zero';
      const a = ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
      const b = ['', '', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
      const g = ['', 'thousand', 'million', 'billion'];
      const makeGroup = ([ones,tens,huns]) => {
        return [
          huns === 0 ? '' : a[huns] + ' hundred',
          tens === 0 ? '' : (tens < 2 ? a[10 * tens + ones] : b[tens] + (ones ? '-' + a[ones] : '')),
          tens < 2 ? '' : a[ones]
        ].filter(Boolean).join(' ');
      };
      const numStr = String(num);
      const groups = [];
      for(let i = numStr.length; i > 0; i -= 3) groups.push(numStr.substring(Math.max(0, i-3), i));
      const words = groups.map((group, idx) => {
        const n = parseInt(group, 10);
        if(!n) return '';
        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const o = n % 10;
        return makeGroup([o, t, h]) + (g[idx] ? ' ' + g[idx] : '');
      }).filter(Boolean).reverse().join(' ');
      return words;
    }

    // Append the items table only. Order details and footer/signature
    // sections are intentionally omitted from the exported invoice PDF.
    container.appendChild(table);
    // Append a short order summary/note (matches WhatsApp notification) at the bottom of the invoice
    try{
      const orderNoteDiv = document.createElement('div');
      orderNoteDiv.className = 'invoice-order-note';
      try{ orderNoteDiv.textContent = buildWhatsappOrderMessage(); }catch(e){ orderNoteDiv.textContent = '#ORDER PLACED\nSend payment details'; }
      container.appendChild(orderNoteDiv);
    }catch(e){ /* ignore silently if buildWhatsappOrderMessage missing */ }
    el.appendChild(container);
    document.body.appendChild(el);
    return el;
  }

  // Generate PDF (html2canvas + jsPDF). Returns a Promise<Blob>.
  // Accepts optional options {scale, quality} to control html2canvas scale and JPEG quality.
  function generateInvoicePdf(items, subtotal, opts){
    opts = opts || {};
    const desiredScale = (typeof opts.scale === 'number') ? opts.scale : 3;
    const desiredQuality = (typeof opts.quality === 'number') ? opts.quality : 0.95;
    return new Promise(async (resolve, reject) => {
      // Load libs if needed
      try{
        if(typeof window.html2canvas === 'undefined') await loadScript(HTML2CANVAS_URL);
        if(typeof window.jspdf === 'undefined') await loadScript(JSPDF_URL);
      }catch(e){
        // If libraries fail to load, reject and fallback will be used
        console.error('Failed to load PDF libs', e);
        reject(new Error('Failed to load PDF libraries')); return;
      }

      const invoiceEl = createInvoiceElement({ items, subtotal });
      try{
        // Ensure images have loaded (decode) before capturing the element so html2canvas has all image data
        const imgs = invoiceEl.querySelectorAll('img');
        try{ await Promise.all(Array.from(imgs).map(img => img.decode ? img.decode() : Promise.resolve())); }catch(e){ /* ignore */ }
        // Increase scale for better print quality and to fill A4 better
        const html2canvasFn = window.html2canvas || window.html2canvas;
        const HTML2CANVAS_SCALE = desiredScale; // adjust (1.5, 2, 3) to trade quality vs file size
        console.log('[checkout] calling html2canvas to render invoice DOM');
        const canvas = await html2canvasFn(invoiceEl, { scale: HTML2CANVAS_SCALE, useCORS: true });
        console.log('[checkout] html2canvas returned canvas, creating PDF');
        // Locate jsPDF constructor in whichever shape the UMD/module exposes it
        let jsPDFConstructor = null;
        if(window.jspdf && window.jspdf.jsPDF) jsPDFConstructor = window.jspdf.jsPDF;
        else if(window.jsPDF) jsPDFConstructor = window.jsPDF;
        else if(window.jspdf) jsPDFConstructor = window.jspdf; // fallback
        if(!jsPDFConstructor){
          throw new Error('jsPDF constructor not found after loading library');
        }
        const doc = new jsPDFConstructor({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const imgData = canvas.toDataURL('image/jpeg', desiredQuality);
        // Fit to width with modest margins, and split into multiple pages if height exceeds page height
        const margin = 12;
        const width = pageWidth - margin * 2; // width on PDF (points)
        const scaleFactor = width / canvas.width; // points per pixel
        const totalHeightPt = canvas.height * scaleFactor; // total rendered height in points
        const pageHeightAvailablePt = pageHeight - margin * 2;
        // Compute how many vertical pages we need
        const pageHeightPx = Math.floor(pageHeightAvailablePt / scaleFactor); // in source canvas pixels

        if(canvas.height <= pageHeightPx){
          // Single page fits — add directly
          doc.addImage(imgData, 'JPEG', margin, margin, width, canvas.height * scaleFactor);
        } else {
          // Multi-page: slice the canvas vertically and add page images sequentially
          let srcY = 0;
          let pageIndex = 0;
          while(srcY < canvas.height){
            const sliceHeightPx = Math.min(pageHeightPx, canvas.height - srcY);
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = canvas.width;
            pageCanvas.height = sliceHeightPx;
            const pctx = pageCanvas.getContext('2d');
            // draw the slice onto the temporary canvas
            pctx.drawImage(canvas, 0, srcY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
            const pageData = pageCanvas.toDataURL('image/jpeg', desiredQuality);
            const pageHeightPt = sliceHeightPx * scaleFactor;
            if(pageIndex > 0) doc.addPage();
            doc.addImage(pageData, 'JPEG', margin, margin, width, pageHeightPt);
            srcY += sliceHeightPx;
            pageIndex += 1;
          }
        }
        const blob = doc.output('blob');
        // Cleanup DOM
        invoiceEl.remove();
        console.log('[checkout] generated PDF blob, resolving');
        resolve(blob);
      }catch(err){
        invoiceEl.remove();
        console.error('[checkout] generateInvoicePdf failed', err);
        reject(err);
      }
    });
  }

  // Upload PDF to backend endpoint; server should handle sending via WhatsApp Business API
  async function sendPdfToBackend(pdfBlob, phoneNumber, message){
    if(!BACKEND_WHATSAPP_ENDPOINT) throw new Error('No backend endpoint configured');
    const fd = new FormData();
    fd.append('file', pdfBlob, 'order-received.pdf');
    fd.append('phone', phoneNumber);
    fd.append('message', message);
    console.log('[checkout] sending PDF to backend at', BACKEND_WHATSAPP_ENDPOINT);
    const res = await fetch(BACKEND_WHATSAPP_ENDPOINT, { method: 'POST', body: fd });
    console.log('[checkout] backend responded status', res.status);
    if(!res.ok) throw new Error('Failed to upload invoice');
    const json = await res.json();
    console.log('[checkout] backend JSON response', json);
    return json;
  }

  // Upload PDF to backend endpoint; server should handle sending the PDF via SMTP
  async function sendPdfToEmail(pdfBlob, toEmail){
    if(!BACKEND_EMAIL_ENDPOINT) throw new Error('No backend email endpoint configured');
    const fd = new FormData();
    fd.append('file', pdfBlob, 'order-received.pdf');
    if(toEmail) fd.append('to', toEmail);
    // Optionally include shipping info so the backend can use it in the email body
    try{ fd.append('name', fullNameEl && fullNameEl.value ? fullNameEl.value : ''); }catch(e){}
    try{ fd.append('phone', phoneEl && phoneEl.value ? phoneEl.value : ''); }catch(e){}
    try{ fd.append('address', addressEl && addressEl.value ? addressEl.value : ''); }catch(e){}
    console.log('[checkout] sending PDF to email endpoint at', BACKEND_EMAIL_ENDPOINT);
    const res = await fetch(BACKEND_EMAIL_ENDPOINT, { method: 'POST', body: fd });
    console.log('[checkout] email backend responded status', res.status);
    let bodyText = '';
    try{ bodyText = await res.text(); }catch(e){ bodyText = ''; }
    // Attempt to parse JSON response for better debugging
    let json = null;
    try{ json = JSON.parse(bodyText); }catch(e){ json = null; }
    if(!res.ok){
      const errMsg = (json && json.error) ? json.error : (bodyText || 'Unknown server error');
      console.error('[checkout] email backend error response', res.status, errMsg);
      throw new Error('Failed to send invoice via email backend: ' + errMsg);
    }
    try{ console.log('[checkout] email backend JSON response', json || bodyText); }catch(e){}
    return json || { raw: bodyText };
  }

    // Upload PDF to a Telegram-capable backend endpoint; server should call Telegram API
    async function sendPdfToTelegram(pdfBlob, chatId, caption){
        if(!BACKEND_TELEGRAM_ENDPOINT) throw new Error('No backend Telegram endpoint configured');
      const fd = new FormData();
      fd.append('file', pdfBlob, 'order-received.pdf');
      if(chatId) fd.append('chat_id', chatId);
      if(caption) fd.append('caption', caption);
      console.log('[checkout] sending PDF to Telegram endpoint at', BACKEND_TELEGRAM_ENDPOINT);
      const res = await fetch(BACKEND_TELEGRAM_ENDPOINT, { method: 'POST', body: fd });
      console.log('[checkout] Telegram backend responded status', res.status);
      let bodyText = '';
      try{ bodyText = await res.text(); }catch(e){ bodyText = ''; }
      let json = null;
      try{ json = JSON.parse(bodyText); }catch(e){ json = null; }
      if(!res.ok){
        const errMsg = (json && json.error) ? json.error : (bodyText || 'Unknown server error');
        console.error('[checkout] Telegram backend error response', res.status, errMsg);
        throw new Error('Failed to send invoice via Telegram backend: ' + errMsg);
      }
      try{ console.log('[checkout] Telegram backend JSON response', json || bodyText); }catch(e){}
      return json || { raw: bodyText };
    }

    // Attempt to send the PDF directly to the Telegram Bot API from the client.
    // NOTE: This requires the bot token to be present; embedding the token in client-side JS
    // is insecure because it exposes the token to anyone who visits the page. Use only for
    // testing or highly trusted deployments. Prefer BACKEND_TELEGRAM_ENDPOINT for production.
    async function sendPdfDirectToTelegram(pdfBlob, botToken, chatId, caption){
      if(!botToken) throw new Error('No Telegram bot token configured for direct send');
      if(!chatId) throw new Error('No Telegram chat id configured for direct send');
      const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendDocument`;
      const fd = new FormData();
      fd.append('chat_id', chatId);
      fd.append('caption', caption || 'Invoice');
      // Ensure notifications are not disabled (explicitly false)
      try{ fd.append('disable_notification', 'false'); }catch(e){}
      // Telegram expects a 'document' field when uploading files
      fd.append('document', pdfBlob, 'order-received.pdf');
      console.log('[checkout] sending PDF directly to Telegram Bot API (endpoint hidden for security)');
      const res = await fetch(url, { method: 'POST', body: fd });
      let bodyText = '';
      try{ bodyText = await res.text(); }catch(e){}
      if(!res.ok){
        let json = null;
        try{ json = JSON.parse(bodyText); }catch(e){ json = null; }
        const errMsg = (json && json.description) ? json.description : bodyText || 'Unknown server error';
        console.error('[checkout] Telegram Bot API error', res.status, errMsg);
        throw new Error('Failed to send invoice via Telegram Bot API: ' + errMsg);
      }
      try{ console.log('[checkout] Telegram Bot API response', JSON.parse(bodyText)); }catch(e){ console.log('[checkout] Telegram Bot API response', bodyText); }
      return JSON.parse(bodyText);
    }

  // Third-party email provider support removed — no client-side email sending provided.
  // If you want a reliable server-side email relay, configure `BACKEND_WHATSAPP_ENDPOINT`
  // and call `sendPdfToBackend` once implemented.

  function openWhatsAppChat(number, message){
    // For manual fallback, open wa.me link with encoded message
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
  }

  // Build a standard WhatsApp notification to the seller when an order is placed.
  // This uses the first name entered in the form, a current date/time string in D/M/YYYY-HH:MM format
  // and the requested message body.
  function buildWhatsappOrderMessage(){
    try{
      const full = (fullNameEl && fullNameEl.value) ? (fullNameEl.value || '').trim() : '';
      const firstName = full ? full.split(/\s+/)[0] : 'Customer';
      const now = new Date();
      const dd = String(now.getDate());
      const mm = String(now.getMonth() + 1);
      const yyyy = now.getFullYear();
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const dateStr = `${dd}/${mm}/${yyyy}`;
      const timeStr = `${hh}:${min}`;
      return `#ORDER PLACED - from ${firstName}\nFG- ${dateStr}-${timeStr}\n\nSend payment details`;
    }catch(e){
      console.warn('[checkout] buildWhatsappOrderMessage failed', e);
      return '#ORDER PLACED\nSend payment details';
    }
  }


  // Setup WhatsApp disclaimer modal behavior
  const whatsappDisclaimerModal = document.getElementById('whatsappDisclaimerModal');
  const whatsappAccept = document.getElementById('whatsappAccept');
  const whatsappDecline = document.getElementById('whatsappDecline');
  function showWhatsappDisclaimer(){
    if(!whatsappDisclaimerModal) return;
    whatsappDisclaimerModal.classList.remove('hidden');
    whatsappDisclaimerModal.setAttribute('aria-hidden','false');
    try{ whatsappAccept && whatsappAccept.focus(); }catch(e){}
  }
  function hideWhatsappDisclaimer(){
    if(!whatsappDisclaimerModal) return;
    whatsappDisclaimerModal.classList.add('hidden');
    whatsappDisclaimerModal.setAttribute('aria-hidden','true');
  }

  placeOrderBtn && placeOrderBtn.addEventListener('click', function(e){
    e.preventDefault();
    hideOrderError();
    // Validate shipping form first so users see exactly what they need to fill in
    // (even if the cart is empty). If the form is invalid, we show field-specific
    // errors and focus the first invalid field.
    if(!validateShippingForm()){
      try{ const firstInvalid = document.querySelector('[aria-invalid="true"]'); firstInvalid && firstInvalid.focus(); }catch(e){}
      return;
    }
    // After validating the form, check whether the cart contains items and show
    // a cart-level error if it's empty.
    if(!cartItems || cartItems.length === 0){
      showOrderError('Cart is empty');
      // keep focus on button for keyboard users
      try{ placeOrderBtn && placeOrderBtn.focus(); }catch(e){}
      return;
    }
    // If invoice is already generated, clicking the main button should create the PDF (if needed)
    // and attempt to send/share it via one of the available methods
    if(invoiceGenerated || (placeOrderBtn && placeOrderBtn.getAttribute('data-whatsapp') === 'true')){
      // Validate shipping form even when invoice is already generated — ensure data exists
      if(!validateShippingForm()){
        try{ const firstInvalid = document.querySelector('[aria-invalid="true"]'); firstInvalid && firstInvalid.focus(); }catch(e){}
        return;
      }
      const number = '2349162919586';
      const itemsText = cartItems.map(i => `• ${i.qty}x ${i.title}`).join('\n');
      const shippingInfo = (fullNameEl && phoneEl && addressEl) ? `\nShip to:\n${fullNameEl.value}\n${phoneEl.value}\n${addressEl.value}\n` : '';
      const message = `#ORDER REQUEST\nHello! I have placed an order at EMMY STORE with the items listed below:\n${itemsText}\nTotal: ${totalEl.textContent}${shippingInfo}\nPlease send the payment details when convenient so I can complete the purchase. Thank you!`;

      // If invoice was already generated and the button was marked as WhatsApp-ready,
      // open the wa.me chat immediately (fast path) instead of regenerating the PDF.
      if(invoiceGenerated && placeOrderBtn && placeOrderBtn.getAttribute('data-whatsapp') === 'true'){
        placeOrderBtn.classList.remove('shaky','processing');
        // Fast path: if we already have the PDF blob, attempt to use the Web Share API
        // to let users attach the file; otherwise include a link to the blob object URL
        (async function(){
          try{
            if(generatedPdfBlob && navigator.share && navigator.canShare && navigator.canShare({ files: [new File([generatedPdfBlob], 'order-received.pdf')] } )){
              const file = new File([generatedPdfBlob], 'order-received.pdf', { type: 'application/pdf' });
              try{ await navigator.share({ title: 'Invoice', text: message, files: [file] }); return; }catch(e){ /* fallback to open chat */ }
            }
            // If we have a blob URL and cannot use the native share, show share modal to let user choose actions
            if(generatedPdfUrl){
              try{ showPdfShareModal(generatedPdfUrl); return; }catch(e){ openWhatsAppChat(number, message + '\n\nInvoice: ' + generatedPdfUrl); return; }
            }
            // If we don't have the PDF yet, fall through so the existing generation logic runs below
          }catch(err){ console.error('[checkout] fast-path share failed', err); }
        })();
        return;
      }

      // Remove visual state on redirect
      placeOrderBtn.classList.remove('shaky','processing');

      // Create PDF and either upload to the backend (recommended) or use the Web Share API/dl fallback
      (async function(){
        try{
          placeOrderBtn.disabled = true;
          placeOrderBtn.textContent = 'Preparing Invoice...';
          const subtotal = cartItems.reduce((s,i)=> s + i.price*i.qty, 0);
          console.log('[checkout] preparing to generate PDF for', cartItems.length, 'items, subtotal:', subtotal);
          const pdfBlob = await generateInvoicePdf(cartItems, subtotal);
          console.log('[checkout] PDF generation complete, size (bytes):', pdfBlob.size || 'unknown');
          // No third-party email provider configured — PDF stored in memory and no download will be triggered
          // No UI notification shown — PDF stored silently in memory

          if(BACKEND_WHATSAPP_ENDPOINT){
            // Upload & request server to send via WhatsApp Business API
            try{
              console.log('[checkout] uploading PDF to backend endpoint');
              await sendPdfToBackend(pdfBlob, number, message);
              console.log('[checkout] upload successful');
              showOrderSuccessModal();
              // Optionally open the chat if desired
              // openWhatsAppChat(number, 'I have sent an invoice through your server');
            }catch(err){
              console.error('[checkout] Send to backend failed', err);
              showOrderError('Failed to send invoice via backend');
              // Fallback: do not download; just open chat
              openWhatsAppChat(number, message);
            }
          } else if(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID){
            // Prefer to send directly via bot token and chat id if configured
            try{
              console.log('[checkout] sending PDF directly to Telegram bot API');
              const telegramCaption = buildWhatsappOrderMessage();
              await sendPdfDirectToTelegram(pdfBlob, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, telegramCaption);
              console.log('[checkout] Telegram bot send successful');
              showOrderSuccessModal();
            }catch(err){
              console.error('[checkout] Failed to send invoice via Telegram bot API', err);
              // fallback to backend / share actions
            }
            } else if(BACKEND_TELEGRAM_ENDPOINT){
            // Send via Telegram backend endpoint if configured
              try{
                const telegramCaption = buildWhatsappOrderMessage();
              console.log('[checkout] uploading PDF to Telegram backend');
              await sendPdfToTelegram(pdfBlob, null, telegramCaption);
              console.log('[checkout] Telegram upload successful');
              showOrderSuccessModal();
            }catch(err){
              // Suppress the UI error; log with corrected message.
              console.error('[checkout] Failed to send invoice via Telegram (server)', err);
              // fallback to web share or open chat
            }
          } else if(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], 'order-received.pdf')] } )){
            try{
              const file = new File([pdfBlob], 'order-received.pdf', { type: 'application/pdf' });
              await navigator.share({ title: 'Invoice', text: message, files: [file] });
            }catch(err){
              console.error('Web share failed', err);
              // fallback - do not auto-download; only open chat and inform user that PDF is converted
              // Note: PDF is stored in memory (generatedPdfBlob) for later use.
              // No UI notification shown — PDF stored; WhatsApp chat opened silently
              openWhatsAppChat(number, message);
            }
          } else {
            // Last fallback: do not download; open chat and let user take manual steps if needed
            // No UI notification shown — PDF stored; WhatsApp chat opened silently
            openWhatsAppChat(number, message);
          }
          // Remove the BUY NOW / place order button permanently now that invoice was generated/stored
          try{
            // Hide the place order button instead of removing it so we can restore it on cancel
            if(placeOrderBtn){
              try{ placeOrderBtn.style.display = 'none'; }catch(_){}
            }
          }catch(remErr){ console.warn('[checkout] failed to hide placeOrder button', remErr); }
        }catch(err){
          console.error('Invoice generation failed', err);
          showOrderError('Failed to prepare invoice');
        }finally{
          if(placeOrderBtn){
            placeOrderBtn.disabled = false;
            placeOrderBtn.textContent = 'Proceed';
          }
        }
      })();
      return;
    }

    // Otherwise, show WhatsApp disclaimer before generating invoice. If accepted, proceed.
    // Start invoice generation immediately when form validation passes
    startInvoiceGeneration();
  });

  // Whatsapp modal buttons
  whatsappAccept && whatsappAccept.addEventListener('click', function(){
    // Ensure shipping form is valid before accepting. Keep modal open if invalid.
    if(!validateShippingForm()){
      try{ const firstInvalid = document.querySelector('[aria-invalid="true"]'); firstInvalid && firstInvalid.focus(); }catch(e){}
      return;
    }
    hideWhatsappDisclaimer();
    // If invoice already generated — this button should redirect to WhatsApp
    if(invoiceGenerated || (placeOrderBtn && placeOrderBtn.getAttribute('data-whatsapp') === 'true')){
      // Redirect to WhatsApp with prefilled message (keep cart until user cancels)
      const number = '2349162919586';
      const itemsText = cartItems.map(i => `• ${i.qty}x ${i.title}`).join('\n');
      const shippingInfo = (fullNameEl && phoneEl && addressEl) ? `\nShip to:\n${fullNameEl.value}\n${phoneEl.value}\n${addressEl.value}\n` : '';
      const message = `#ORDER REQUEST\nHello! I have placed an order at EMMY STORE with the items listed below:\n${itemsText}\nTotal: ${totalEl.textContent}${shippingInfo}\nPlease send the payment details when convenient so I can complete the purchase. Thank you!`;
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank');
      return;
    }
    // Otherwise, focus the place order button and start invoice flow
    try{ placeOrderBtn && placeOrderBtn.focus(); }catch(e){}
    startInvoiceGeneration();
  });
  whatsappDecline && whatsappDecline.addEventListener('click', function(){
    hideWhatsappDisclaimer();
    try{ placeOrderBtn && placeOrderBtn.focus(); }catch(e){}
    // If invoice already generated, treat decline as cancel and clear the cart
    if(invoiceGenerated){
      cartItems = [];
      writeCart(cartItems);
      renderOrder();
      invoiceGenerated = false;
      if(placeOrderBtn){
        placeOrderBtn.disabled = false;
        placeOrderBtn.classList.remove('success','shaky','processing');
        placeOrderBtn.textContent = 'Place Order';
        try{ placeOrderBtn.removeAttribute('data-whatsapp'); }catch(e){}
      }
        // Restore Clear Cart button to original look
        restoreClearCart();
    }
    // Do not proceed — user declined
  });

  if(whatsappDisclaimerModal){
    whatsappDisclaimerModal.addEventListener('click', function(e){ if(e.target === whatsappDisclaimerModal) hideWhatsappDisclaimer(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') hideWhatsappDisclaimer(); });
  }

  // Note: placeOrderBtn click now handles redirect when invoiceGenerated === true

  // Close success modal from button or backdrop/escape
  orderSuccessClose && orderSuccessClose.addEventListener('click', function(){ hideOrderSuccessModal(); });
  if(orderSuccessModal){
    orderSuccessModal.addEventListener('click', function(e){ if(e.target === orderSuccessModal) hideOrderSuccessModal(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') hideOrderSuccessModal(); });
  }

  // PDF Share modal handling
  const pdfShareModal = document.getElementById('pdfShareModal');
  const pdfPreviewFrame = document.getElementById('pdfPreview');
  const pdfShareBtn = document.getElementById('pdfShareBtn');
  const pdfDownloadBtn = document.getElementById('pdfDownloadBtn');
  const pdfCopyLinkBtn = document.getElementById('pdfCopyLinkBtn');
  const pdfOpenChatBtn = document.getElementById('pdfOpenChatBtn');
  const pdfSendTelegramBtn = document.getElementById('pdfSendTelegramBtn');
  const pdfShareClose = document.getElementById('pdfShareClose');

  function showPdfShareModal(url){
    if(!pdfShareModal) return;
    try{ pdfPreviewFrame.src = url || ''; }catch(e){}
    pdfShareModal.classList.remove('hidden'); pdfShareModal.setAttribute('aria-hidden','false');
    try{ pdfShareClose && pdfShareClose.focus(); }catch(e){}
  }
  function hidePdfShareModal(){
    if(!pdfShareModal) return;
    pdfShareModal.classList.add('hidden'); pdfShareModal.setAttribute('aria-hidden','true');
    try{ pdfPreviewFrame.src = ''; }catch(e){}
  }

  // Ensure clicking backdrop or pressing Escape closes the modal
  if(pdfShareModal){
    pdfShareModal.addEventListener('click', function(e){ if(e.target === pdfShareModal) hidePdfShareModal(); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') hidePdfShareModal(); });
  }

  // Share / Download / Copy Link / Open Chat handlers for PDF modal
  if(pdfShareBtn){ pdfShareBtn.addEventListener('click', async function(){
    if(!generatedPdfBlob) return showOrderError('No invoice available to share');
    try{
      if(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([generatedPdfBlob], 'invoice.pdf')] } )){
        const file = new File([generatedPdfBlob], 'invoice.pdf', { type: 'application/pdf' });
        await navigator.share({ title: 'Invoice', text: 'Invoice from EMMY STORE', files: [file] });
        hidePdfShareModal();
        return;
      }
      if(generatedPdfUrl) window.open(generatedPdfUrl, '_blank');
    }catch(err){ console.error('[checkout] share failed', err); showOrderError('Sharing failed'); }
  }); }
  if(pdfDownloadBtn){ pdfDownloadBtn.addEventListener('click', function(){ if(!generatedPdfUrl) return showOrderError('No invoice available'); const a = document.createElement('a'); a.href = generatedPdfUrl; a.download = 'invoice.pdf'; document.body.appendChild(a); a.click(); a.remove(); }); }
  if(pdfCopyLinkBtn){ pdfCopyLinkBtn.addEventListener('click', async function(){ if(!generatedPdfUrl) return showOrderError('No invoice available'); try{ await navigator.clipboard.writeText(generatedPdfUrl); showOrderMessage('Link copied to clipboard', true);}catch(e){ showOrderError('Could not copy link'); } }); }
  if(pdfOpenChatBtn){ pdfOpenChatBtn.addEventListener('click', async function(){
    if(!generatedPdfBlob){ showOrderError('No invoice available to share'); return; }
    const number = '2349162919586';
    const itemsText = cartItems.map(i => `• ${i.qty}x ${i.title}`).join('\n');
    const shippingInfo = (fullNameEl && phoneEl && addressEl) ? `\nShip to:\n${fullNameEl.value}\n${phoneEl.value}\n${addressEl.value}\n` : '';
    const message = `#ORDER REQUEST\nHello! I have placed an order at EMMY STORE with the items listed below:\n${itemsText}\nTotal: ${totalEl.textContent}${shippingInfo}\nPlease send the payment details when convenient so I can complete the purchase. Thank you!`;
    // Preferred: send via backend if configured (this will cause server to use WhatsApp Business API or other integration)
    if(BACKEND_WHATSAPP_ENDPOINT){
      try{
        showOrderMessage('Sending invoice via WhatsApp (server)...', true);
        await sendPdfToBackend(generatedPdfBlob, number, message);
        showOrderMessage('Invoice sent via WhatsApp by server', true);
        hidePdfShareModal();
        return;
      }catch(err){ console.error('[checkout] sendPdfToBackend failed', err); showOrderError('Failed to send via server'); }
    } else if(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID){
      try{
        const telegramCaption = buildWhatsappOrderMessage();
        showOrderMessage('Sending invoice via Telegram (bot API)...', true);
        await sendPdfDirectToTelegram(generatedPdfBlob, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, telegramCaption);
        showOrderMessage('Invoice sent via Telegram by bot', true);
        hidePdfShareModal();
        try{ cartItems = []; writeCart(cartItems); renderOrder(); document.getElementById('checkoutForm')?.reset(); }catch(e){ console.warn('[checkout] auto-clear cart failed', e); }
                try{ revertToDefaultUI(); }catch(e){}
                try{
                  const waNumber = '2349162919586';
                  const waMessage = buildWhatsappOrderMessage();
                  window.open('https://wa.me/' + waNumber + '?text=' + encodeURIComponent(waMessage), '_blank');
                }catch(e){ console.warn('[checkout] failed to open WhatsApp link', e); }
        return;
      }catch(err){
        console.error('[checkout] sendPdfDirectToTelegram failed', err);
        // fall back to the backend if available
        if(BACKEND_TELEGRAM_ENDPOINT){
          try{
            showOrderMessage('Fallback: Sending via Telegram server...', true);
            await sendPdfToTelegram(generatedPdfBlob, null, telegramCaption);
            showOrderMessage('Invoice sent via Telegram by server', true);
            hidePdfShareModal();
            try{ cartItems = []; writeCart(cartItems); renderOrder(); document.getElementById('checkoutForm')?.reset(); }catch(e){ console.warn('[checkout] auto-clear cart failed', e); }
            try{ revertToDefaultUI(); }catch(e){}
            try{
              const waNumber = '2349162919586';
              const waMessage = buildWhatsappOrderMessage();
              window.open('https://wa.me/' + waNumber + '?text=' + encodeURIComponent(waMessage), '_blank');
            }catch(e){ console.warn('[checkout] failed to open WhatsApp link', e); }
            return;
          }catch(fbErr){ console.error('[checkout] Telegram backend fallback failed', fbErr); }
        }
      }
    } else if(BACKEND_TELEGRAM_ENDPOINT){
      try{
        showOrderMessage('Sending invoice via Telegram (server)...', true);
        const telegramCaption = buildWhatsappOrderMessage();
        await sendPdfToTelegram(generatedPdfBlob, null, telegramCaption);
        showOrderMessage('Invoice sent via Telegram by server', true);
        hidePdfShareModal();
        try{ cartItems = []; writeCart(cartItems); renderOrder(); document.getElementById('checkoutForm')?.reset(); }catch(e){ console.warn('[checkout] auto-clear cart failed', e); }
        try{ revertToDefaultUI(); }catch(e){}
        return;
      }catch(err){
        console.error('[checkout] sendPdfToTelegram failed', err);
        // UI notification suppressed for Telegram send failure.
      }
    }
    // Fallback: use the Web Share API to share file directly to apps that support attachments (works best on mobile)
    try{
      if(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([generatedPdfBlob], 'invoice.pdf')] } )){
        const file = new File([generatedPdfBlob], 'invoice.pdf', { type: 'application/pdf' });
        await navigator.share({ title: 'Invoice', text: message, files: [file] });
        hidePdfShareModal();
        return;
      }
    }catch(err){ console.warn('[checkout] web share failed', err); }
    // Last resort: open a WhatsApp chat with a message. Note: blob URLs are local-only and won't be accessible to the recipient.
    if(generatedPdfUrl){
      showOrderError('Blob URLs are local-only and will not be accessible by the recipient. Consider using the Share or Download actions, or configure a server to send the file via WhatsApp Business API.');
      // Fall back to pre-fill chat with a message that includes the local link anyway
      openWhatsAppChat(number, message + '\n\nInvoice: ' + generatedPdfUrl);
    } else {
      openWhatsAppChat(number, message);
    }
    hidePdfShareModal();
  }); }
  if(pdfSendTelegramBtn){ pdfSendTelegramBtn.addEventListener('click', async function(){
    if(!generatedPdfBlob){ showOrderError('No invoice available to share'); return; }
    // Try to use backend if configured
    const chatId = null; // Use server env default by default; you may prompt for chat id
    const itemsText = cartItems.map(i => `• ${i.qty}x ${i.title}`).join('\n');
    const shippingInfo = (fullNameEl && phoneEl && addressEl) ? `\nShip to:\n${fullNameEl.value}\n${phoneEl.value}\n${addressEl.value}\n` : '';
    // Short caption matching the order placed format (use buildWhatsappOrderMessage)
    const caption = buildWhatsappOrderMessage();
    if(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID){
      try{
        showOrderMessage('Sending invoice via Telegram (bot API)...', true);
        await sendPdfDirectToTelegram(generatedPdfBlob, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, caption);
        showOrderMessage('Invoice sent via Telegram by bot', true);
        hidePdfShareModal();
        return;
      }catch(err){
        console.error('[checkout] sendPdfDirectToTelegram failed', err);
        if(BACKEND_TELEGRAM_ENDPOINT){
          try{
            showOrderMessage('Fallback: Sending via Telegram server...', true);
            await sendPdfToTelegram(generatedPdfBlob, chatId, caption);
            showOrderMessage('Invoice sent via Telegram by server', true);
            hidePdfShareModal();
            return;
          }catch(fbErr){ console.error('[checkout] Telegram backend fallback failed', fbErr); }
        }
      }
    }
    if(BACKEND_TELEGRAM_ENDPOINT){
      try{
        showOrderMessage('Sending invoice via Telegram (server)...', true);
        await sendPdfToTelegram(generatedPdfBlob, chatId, caption);
        showOrderMessage('Invoice sent via Telegram by server', true);
        hidePdfShareModal();
        return;
      }catch(err){ console.error('[checkout] sendPdfToTelegram failed', err); /* UI notification suppressed for Telegram failures */ }
    }
    // Informational notice suppressed to avoid UI noise; check console for details.
    console.info('[checkout] No Telegram server configured to send the attachment. See settings.');
  }); }
  pdfShareClose && pdfShareClose.addEventListener('click', function(e){ hidePdfShareModal(); });

  // Clear cart button — show modal confirmation instead of blocking confirm()
  const clearCartBtn = document.getElementById('clearCart');
  // Save original Clear Cart button content so we can convert it while generating and restore later
  let originalClearCartHTML = clearCartBtn ? clearCartBtn.innerHTML : '';
  let originalClearCartClassName = clearCartBtn ? clearCartBtn.className : '';

  function setClearCartToCancelMode(){
    if(!clearCartBtn) return;
    // Set as Cancel Order button with a grey 'x' icon and red background
    clearCartBtn.innerHTML = '<svg class="cancel-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="#9aa0a6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>Cancel Order';
    // Add class to style as cancel state (red background)
    clearCartBtn.classList.add('cancel-order');
    // Ensure the button doesn't trigger the clear-cart modal when in cancel state — click will act as cancel
  }

  function restoreClearCart(){
    if(!clearCartBtn) return;
    clearCartBtn.innerHTML = originalClearCartHTML || 'Clear Cart';
    clearCartBtn.className = originalClearCartClassName || 'btn btn-remove large';
  }

  function revertToDefaultUI(){
    try{
      // Remove ORDER NOW button if present
      const orderNow = document.getElementById('orderNow');
      if(orderNow){
        try{ orderNow.removeAttribute && orderNow.removeAttribute('data-sent'); }catch(_){}
        try{ if(orderNow && orderNow.parentNode) orderNow.parentNode.removeChild(orderNow); }catch(_){}
      }
    }catch(e){ console.warn('[checkout] failed to remove ORDER NOW button', e); }
    try{
      // Restore place order button visibility and default state
      const placeBtnEl = (typeof placeOrderBtn !== 'undefined' && placeOrderBtn) ? placeOrderBtn : document.getElementById('placeOrder');
      if(placeBtnEl){
        try{ placeBtnEl.style.display = ''; }catch(e){}
        try{ placeBtnEl.disabled = false; }catch(e){}
        try{ placeBtnEl.classList.remove('processing','success','shaky'); }catch(e){}
        try{ placeBtnEl.textContent = 'Place Order'; }catch(e){}
        try{ placeBtnEl.setAttribute('aria-label','Place Order'); }catch(e){}
        try{ placeBtnEl.removeAttribute('data-whatsapp'); }catch(e){}
        try{ placeBtnEl.setAttribute('title','Place Order'); }catch(e){}
      }
    }catch(e){ console.warn('[checkout] failed to restore Place Order button', e); }
    try{ restoreClearCart(); }catch(e){ console.warn('[checkout] failed to restore Clear Cart button', e); }
    try{
      invoiceGenerated = false;
      try{ if(generatedPdfUrl){ URL.revokeObjectURL(generatedPdfUrl); generatedPdfUrl = null; } }catch(e){}
      generatedPdfBlob = null;
      writeCart(cartItems);
      renderOrder();
      try{ if(window.Cart && typeof window.Cart.updateTopbarCart === 'function') window.Cart.updateTopbarCart(); }catch(e){}
    }catch(e){ console.warn('[checkout] revertToDefaultUI cleanup error', e); }
  }

  function cancelInvoiceGeneration(){
    // Called to cancel generation or cancel a generated invoice
    console.log('[checkout] cancelInvoiceGeneration called; invoiceGenerated=', invoiceGenerated);
    // If invoice was already generated, clear cart — otherwise just stop processing
    if(invoiceGenerated){
      cartItems = [];
      writeCart(cartItems);
      renderOrder();
      try{ if(window.Cart && typeof window.Cart.updateTopbarCart === 'function') window.Cart.updateTopbarCart(); }catch(e){}
    }
    // Reset UI
    invoiceGenerated = false;
    // cleanup generated PDF
    try{ if(generatedPdfUrl){ URL.revokeObjectURL(generatedPdfUrl); generatedPdfUrl = null; } }catch(e){}
    generatedPdfBlob = null;
    placeOrderBtn.disabled = false;
    // Restore the place order button visibility in case it was hidden
    try{ if(placeOrderBtn) placeOrderBtn.style.display = ''; }catch(e){}
    placeOrderBtn.classList.remove('processing','success','shaky');
    placeOrderBtn.textContent = 'Place Order';
    try{ placeOrderBtn.setAttribute('aria-label', 'Place Order'); }catch(e){}
    try{ placeOrderBtn.setAttribute('title', 'Place Order'); }catch(e){}
    // Remove wa.me ready marker
    try{ placeOrderBtn.removeAttribute('data-whatsapp'); }catch(e){}
    // Restore Clear Cart to default
    restoreClearCart();
    // Remove dynamically created ORDER NOW button if present
    try{ const orderNow = document.getElementById('orderNow'); if(orderNow && orderNow.parentNode) orderNow.parentNode.removeChild(orderNow); }catch(e){}
  }
  const clearCartModal = document.getElementById('clearCartModal');
  const clearCartConfirm = document.getElementById('clearCartConfirm');
  const clearCartCancel = document.getElementById('clearCartCancel');

  // showClearCartModal supports two modes: 'clear' (clear the cart) and 'cancel' (cancel invoice generation or cancel generated invoice)
  let clearModalMode = 'clear'; // current modal action context
  function showClearCartModal(mode){
    if(!clearCartModal) return;
    clearModalMode = mode || 'clear';
    if(clearModalMode === 'clear'){
      try{ document.getElementById('clearCartTitle').textContent = 'Clear your cart?'; }catch(e){}
      try{ document.getElementById('clearCartDesc').textContent = 'This will remove all items from your cart.'; }catch(e){}
      try{ clearCartConfirm && (clearCartConfirm.textContent = 'Yes, clear cart'); }catch(e){}
    } else if(clearModalMode === 'cancel'){
      // Message differs based on whether invoice was generated already
      if(invoiceGenerated){
        try{ document.getElementById('clearCartTitle').textContent = 'Cancel order?'; }catch(e){}
        try{ document.getElementById('clearCartDesc').textContent = 'This will cancel the order and remove all items from your cart.'; }catch(e){}
        try{ clearCartConfirm && (clearCartConfirm.textContent = 'Yes, cancel order'); }catch(e){}
      } else {
        try{ document.getElementById('clearCartTitle').textContent = 'Stop generating invoice?'; }catch(e){}
        try{ document.getElementById('clearCartDesc').textContent = 'This will stop the invoice generation but keep your cart intact.'; }catch(e){}
        try{ clearCartConfirm && (clearCartConfirm.textContent = 'Yes, stop'); }catch(e){}
      }
    }
    clearCartModal.classList.remove('hidden');
    clearCartModal.setAttribute('aria-hidden','false');
    // focus the confirm button for keyboard users
    try{ clearCartConfirm && clearCartConfirm.focus(); }catch(e){}
  }
  function hideClearCartModal(){
    if(!clearCartModal) return;
    clearCartModal.classList.add('hidden');
    clearCartModal.setAttribute('aria-hidden','true');
    clearModalMode = 'clear';
  }

  clearCartBtn && clearCartBtn.addEventListener('click', function(e){
    e.preventDefault();
    // If the clear cart button is serving as a 'Cancel Order' control while generating/in success state, show a cancel confirmation modal
    if(clearCartBtn.classList.contains('cancel-order') || (placeOrderBtn && (placeOrderBtn.classList.contains('processing') || invoiceGenerated))){
      showClearCartModal('cancel');
      return;
    }
    showClearCartModal('clear');
  });

  // Confirm clearing modal
  clearCartConfirm && clearCartConfirm.addEventListener('click', function(){
    if(clearModalMode === 'cancel'){
      // Cancel invoice generation or cancel generated invoice. Clearing cart only if invoice was already generated.
      if(invoiceGenerated){
        // Clearing cart as part of canceling generated invoice
        cartItems = [];
        writeCart(cartItems);
        renderOrder();
        try{ if(window.Cart && typeof window.Cart.updateTopbarCart === 'function') window.Cart.updateTopbarCart(); }catch(e){}
      }
      cancelInvoiceGeneration();
    } else {
      // clear (default) — clear cart like before
      cartItems = [];
      writeCart(cartItems);
      // Update UI
      renderOrder();
      // Ensure topbar reflects change (use shared helper if present)
      try{ if(window.Cart && typeof window.Cart.updateTopbarCart === 'function') window.Cart.updateTopbarCart(); }catch(e){}
      try{ if(generatedPdfUrl){ URL.revokeObjectURL(generatedPdfUrl); generatedPdfUrl = null; } }catch(e){}
      generatedPdfBlob = null;
    }
    hideClearCartModal();
  });

  // Cancel modal
  clearCartCancel && clearCartCancel.addEventListener('click', function(){ hideClearCartModal(); });

  // Close modal on backdrop click or Escape
  if(clearCartModal){
    clearCartModal.addEventListener('click', function(e){
      if(e.target === clearCartModal) hideClearCartModal();
    });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') hideClearCartModal(); });
  }

  // Allow pressing / to focus checkout search input
  document.addEventListener('keydown', function(e){
    if(e.key === '/' && document.activeElement.id !== 'search'){
      e.preventDefault();
      const searchEl = document.getElementById('search');
      if(searchEl) searchEl.focus();
    }
  });
});
