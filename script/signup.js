document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signupForm');
    const fullName = document.getElementById('fullName');
    const email = document.getElementById('email');
    const phone = document.getElementById('phone');
    const address = document.getElementById('address');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    const signUpBtn = document.getElementById('signUpBtn');
    const togglePassword = document.getElementById('togglePassword');
    const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');
    const fullNameError = document.getElementById('fullNameError');
    const emailError = document.getElementById('emailError');
    const phoneError = document.getElementById('phoneError');
    const addressError = document.getElementById('addressError');
    const passwordError = document.getElementById('passwordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');

    // Clear inputs that might be autofilled
    [fullName, email, phone, address, password, confirmPassword].forEach((el) => { if (el) el.value = ''; });

    // Helper validation functions
    function validateEmail(value) {
        const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\\.,;:\s@\"]+\.)+[^<>()[\]\\.,;:\s@\"]{2,})$/i;
        return re.test(String(value).toLowerCase().trim());
    }

    function validatePhone(value) {
        // Require exactly 11 digits (numbers only)
        if(!value) return false;
        const digits = String(value).replace(/\D/g, '');
        return digits.length === 11;
    }

    function showError(inputEl, msgEl, text) {
        msgEl.textContent = text;
        inputEl.setAttribute('aria-invalid', 'true');
        const group = inputEl.closest('.form-group');
        if (group) group.classList.add('invalid');
    }

    function clearError(inputEl, msgEl) {
        msgEl.textContent = '';
        inputEl.removeAttribute('aria-invalid');
        const group = inputEl.closest('.form-group');
        if (group) group.classList.remove('invalid');
    }

    // Toggle behavior for both password fields
    function setupToggle(toggleEl, inputEl) {
        if (!toggleEl || !inputEl) return;
        toggleEl.addEventListener('click', () => {
            const isHidden = inputEl.type === 'password';
            const wasFocused = document.activeElement === inputEl;
            inputEl.type = isHidden ? 'text' : 'password';
            toggleEl.setAttribute('aria-pressed', String(isHidden));
            if (isHidden) {
                toggleEl.setAttribute('aria-label', 'Hide password');
                toggleEl.setAttribute('title', 'Hide password');
            } else {
                toggleEl.setAttribute('aria-label', 'Show password');
                toggleEl.setAttribute('title', 'Show password');
            }
            if (wasFocused) {
                const len = inputEl.value.length;
                inputEl.focus({ preventScroll: true });
                try { inputEl.setSelectionRange(len, len); } catch (e) { /* ignore */ }
            }
        });
    }

    setupToggle(togglePassword, password);
    setupToggle(toggleConfirmPassword, confirmPassword);

    // Live input handlers
    fullName.addEventListener('input', () => {
        if (!fullName.value || fullName.value.trim().length >= 2) clearError(fullName, fullNameError);
    });

    email.addEventListener('input', () => {
        if (!email.value || validateEmail(email.value)) clearError(email, emailError);
    });

    if (phone) {
        const phoneHelp = document.getElementById('phoneHelp');
        phone.addEventListener('input', () => {
            // Sanitize: keep digits only, enforce maxlength 11
            try {
                const raw = phone.value || '';
                const sanitized = raw.replace(/\D/g, '').slice(0, 11);
                if (sanitized !== raw) phone.value = sanitized;
            } catch (e) { /* ignore */ }
            if (!phone.value || validatePhone(phone.value)) clearError(phone, phoneError);
            try{
                if(phoneHelp){
                    if((phone.value || '').length > 0){
                        phoneHelp.classList.add('hidden');
                        const desc = phone.getAttribute('aria-describedby');
                        if(desc && desc.indexOf('phoneHelp') !== -1){
                            const parts = desc.split(/\s+/).filter(Boolean).filter(p => p !== 'phoneHelp');
                            if(parts.length) phone.setAttribute('aria-describedby', parts.join(' ')); else phone.removeAttribute('aria-describedby');
                        }
                    } else {
                        phoneHelp.classList.remove('hidden');
                        const desc = phone.getAttribute('aria-describedby');
                        if(!desc || desc.indexOf('phoneHelp') === -1){
                            const newDesc = desc ? (desc + ' phoneHelp') : 'phoneHelp';
                            phone.setAttribute('aria-describedby', newDesc);
                        }
                    }
                }
            }catch(e){}
        });
        // If the field was prefilled on load, hide the help
        try{ if (phone && phone.value && phone.value.trim().length && phoneHelp && phoneHelp.classList){ phoneHelp.classList.add('hidden'); } }catch(e){}
        phone.addEventListener('keydown', (e) => {
            const allowed = ['Backspace','ArrowLeft','ArrowRight','Delete','Tab','Home','End'];
            if (allowed.includes(e.key) || e.metaKey || e.ctrlKey) return;
            if (/\d/.test(e.key)) {
                const digits = (phone.value || '').replace(/\D/g, '');
                if (digits.length >= 11) e.preventDefault();
                return;
            }
            e.preventDefault();
        });
        phone.addEventListener('paste', (e) => {
            try {
                e.preventDefault();
                const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 11);
                const start = phone.selectionStart || 0;
                const end = phone.selectionEnd || 0;
                const raw = phone.value || '';
                const beforeDigits = raw.slice(0, start).replace(/\D/g, '');
                const afterDigits = raw.slice(end).replace(/\D/g, '');
                phone.value = (beforeDigits + paste + afterDigits).slice(0, 11);
            } catch (e) {}
            if (!phone.value || validatePhone(phone.value)) clearError(phone, phoneError);
            try{ if(phoneHelp){ if((phone.value || '').length > 0) phoneHelp.classList.add('hidden'); else phoneHelp.classList.remove('hidden'); } }catch(e){}
        });
    }

    address.addEventListener('input', () => {
        if (!address.value || address.value.trim().length >= 6) clearError(address, addressError);
    });

    password.addEventListener('input', () => {
        if (!password.value || password.value.length >= 6) clearError(password, passwordError);
    });

    confirmPassword.addEventListener('input', () => {
        if (!confirmPassword.value || confirmPassword.value === password.value) clearError(confirmPassword, confirmPasswordError);
    });

    form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        let valid = true;

        // Full name validation: require at least 2 chars and a space (first + last name)
        if (!fullName.value || fullName.value.trim().length < 2 || !fullName.value.trim().includes(' ')) {
            showError(fullName, fullNameError, 'Please provide your full name (first and last).');
            valid = false;
        } else {
            clearError(fullName, fullNameError);
        }

        if (!email.value || !validateEmail(email.value)) {
            showError(email, emailError, 'Please enter a valid email.');
            valid = false;
        } else {
            clearError(email, emailError);
        }

        if (!phone.value || !validatePhone(phone.value)) {
            showError(phone, phoneError, 'Please enter an 11-digit phone number.');
            valid = false;
        } else {
            clearError(phone, phoneError);
        }

        if (!address.value || address.value.trim().length < 6) {
            showError(address, addressError, 'Please enter a valid address.');
            valid = false;
        } else {
            clearError(address, addressError);
        }

        if (!password.value || password.value.length < 6) {
            showError(password, passwordError, 'Password must be 6+ characters.');
            valid = false;
        } else {
            clearError(password, passwordError);
        }

        if (!confirmPassword.value || confirmPassword.value !== password.value) {
            showError(confirmPassword, confirmPasswordError, 'Passwords do not match.');
            valid = false;
        } else {
            clearError(confirmPassword, confirmPasswordError);
        }

        if (!valid) {
            const card = document.querySelector('.login-card');
            card.classList.remove('shake');
            void card.offsetWidth;
            card.classList.add('shake');
            const firstInvalid = form.querySelector('[aria-invalid="true"]');
            if (firstInvalid) firstInvalid.focus();
            return;
        }

        // Mock sign-up flow
        signUpBtn.disabled = true;
        const oldText = signUpBtn.textContent;
        signUpBtn.textContent = 'Creating account...';

        setTimeout(() => {
            signUpBtn.textContent = oldText;
            signUpBtn.disabled = false;
            const existing = form.querySelector('.success-msg');
            if (existing) existing.remove();
            const successMsg = document.createElement('div');
            successMsg.className = 'success-msg';
            successMsg.textContent = 'Account created — redirecting to sign in...';
            successMsg.setAttribute('role', 'status');
            successMsg.setAttribute('aria-live', 'polite');
            form.prepend(successMsg);
            setTimeout(() => window.location.href = 'login.html', 1200);
        }, 1200);
    });

    const googleSignIn = document.getElementById('googleSignIn');
    if (googleSignIn) {
        googleSignIn.addEventListener('click', () => {
            googleSignIn.disabled = true;
            googleSignIn.classList.add('active');
            const info = document.createElement('div');
            info.className = 'success-msg';
            info.textContent = 'Google sign-up is not connected in this demo.';
            info.setAttribute('role', 'status');
            info.setAttribute('aria-live', 'polite');
            form.prepend(info);
            setTimeout(() => {
                info.remove();
                googleSignIn.disabled = false;
                googleSignIn.classList.remove('active');
            }, 2500);
        });
    }

        // Prevent double-click/press on "Sign in" link (Already have an account?) and add smooth fade before redirect
        const signInLink = document.querySelector('.auth-extra a[href$="login.html"]');
        if (signInLink) {
            let navigationStarted = false;

            function navigateOnce(ev) {
                if (navigationStarted) {
                    ev.preventDefault();
                    return;
                }
                navigationStarted = true;
                ev.preventDefault();
                signInLink.dataset.disabled = 'true';
                signInLink.setAttribute('aria-disabled', 'true');
                signInLink.style.pointerEvents = 'none';
                document.documentElement.classList.add('page-transition');
                setTimeout(() => {
                    window.location.href = signInLink.href;
                }, 180);
            }
            signInLink.addEventListener('pointerdown', navigateOnce, { passive: false });
            signInLink.addEventListener('click', navigateOnce, { passive: false });
        }
});
