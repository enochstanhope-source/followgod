document.addEventListener('DOMContentLoaded', () => {
	const form = document.getElementById('loginForm');
	const email = document.getElementById('email');
	const password = document.getElementById('password');
	const signInBtn = document.getElementById('signInBtn');
	const togglePassword = document.getElementById('togglePassword');
	const emailError = document.getElementById('emailError');
	const passwordError = document.getElementById('passwordError');
	// Clear any pre-filled values to avoid browser autofill of saved credentials
	email.value = '';
	password.value = '';
	// Ensure inputs encourage browsers to avoid autofilling
	email.setAttribute('autocomplete', 'off');
	password.setAttribute('autocomplete', 'new-password');

	// On pageshow (bfcache), clear values again to avoid restore from cache
	window.addEventListener('pageshow', () => {
		email.value = '';
		password.value = '';
	});

	function validateEmail(value) {
		// Basic email regex — good for most cases
		const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\\.,;:\s@\"]+\.)+[^<>()[\]\\.,;:\s@\"]{2,})$/i;
		return re.test(String(value).toLowerCase().trim());
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

	togglePassword.addEventListener('click', () => {
		const isHidden = password.type === 'password';
		// remember if the input had focus so we can restore it afterwards
		const wasFocused = document.activeElement === password;
		// toggle value type
		password.type = isHidden ? 'text' : 'password';
		togglePassword.setAttribute('aria-pressed', String(isHidden));
		// keep the ARIA label & title in sync for clarity
		if (isHidden) {
			togglePassword.setAttribute('aria-label', 'Hide password');
			togglePassword.setAttribute('title', 'Hide password');
		} else {
			togglePassword.setAttribute('aria-label', 'Show password');
			togglePassword.setAttribute('title', 'Show password');
		}
		// If the password input was focused before the toggle, keep it focused
		if (wasFocused) {
			// restore focus and caret position to the end of the input
			const len = password.value.length;
			password.focus({ preventScroll: true });
			try { password.setSelectionRange(len, len); } catch (e) { /* ignore for non-focusable input types */ }
		}
	});

	email.addEventListener('input', () => {
		if (!email.value || validateEmail(email.value)) {
			clearError(email, emailError);
		}
	});

	password.addEventListener('input', () => {
		if (!password.value || password.value.length >= 6) {
			clearError(password, passwordError);
		}
	});

	form.addEventListener('submit', (ev) => {
		ev.preventDefault();
		let valid = true;
		// Basic validation
		if (!email.value || !validateEmail(email.value)) {
			showError(email, emailError, 'Please enter a valid email.');
			valid = false;
		} else {
			clearError(email, emailError);
		}

		if (!password.value || password.value.length < 6) {
			showError(password, passwordError, 'Password must be 6+ characters.');
			valid = false;
		} else {
			clearError(password, passwordError);
		}

		if (!valid) {
			// animate card on error
			const card = document.querySelector('.login-card');
			card.classList.remove('shake');
			// Force reflow to restart the animation
			// eslint-disable-next-line no-unused-expressions
			void card.offsetWidth;
			card.classList.add('shake');
			// Focus the first invalid input
			const firstInvalid = form.querySelector('[aria-invalid="true"]');
			if (firstInvalid) firstInvalid.focus();
			return;
		}

		// Mock sign-in flow
		signInBtn.disabled = true;
		const oldText = signInBtn.textContent;
		signInBtn.textContent = 'Signing in...';

		// Simulate network request
		setTimeout(() => {
			signInBtn.textContent = oldText;
			signInBtn.disabled = false;
			// Basic success demo — in real app replace with server call
			// remove any previous messages
			const existing = form.querySelector('.success-msg');
			if (existing) existing.remove();
			const successMsg = document.createElement('div');
			successMsg.className = 'success-msg';
			successMsg.textContent = 'Signed in successfully — redirecting...';
			successMsg.setAttribute('role', 'status');
			successMsg.setAttribute('aria-live', 'polite');
			form.prepend(successMsg);
			setTimeout(() => {
				// Ideally redirect to dashboard or shop
				window.location.href = 'index.html';
			}, 1200);
		}, 1200);
	});

		const googleSignIn = document.getElementById('googleSignIn');
		if (googleSignIn) {
			googleSignIn.addEventListener('click', () => {
				// Demo: show a message that social login isn't wired
				googleSignIn.disabled = true;
				googleSignIn.classList.add('active');
				const info = document.createElement('div');
				info.className = 'success-msg';
				info.textContent = 'Google sign-in is not connected in this demo.';
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

		// Prevent double-click/press on "Create one" link and add smooth fade before redirect
		const createAccountLink = document.querySelector('.auth-extra a[href$="signup.html"]');
		if (createAccountLink) {
			// Guard to prevent multiple navigations from different events (pointerdown/click)
			let navigationStarted = false;

			function navigateOnce(ev) {
				if (navigationStarted) {
					// Prevent default for subsequent events
					ev.preventDefault();
					return;
				}
				navigationStarted = true;
				ev.preventDefault();
				createAccountLink.dataset.disabled = 'true';
				createAccountLink.setAttribute('aria-disabled', 'true');
				createAccountLink.style.pointerEvents = 'none';
				// Kick off a short fade transition on the document, then navigate
				document.documentElement.classList.add('page-transition');
				// Short timeout to allow the transition to start (150ms is visible but quick)
				setTimeout(() => {
					window.location.href = createAccountLink.href;
				}, 180);
			}

			/*
			 Add both pointerdown and click handlers to support touch and mouse devices.
			 Use passive: false so we can call preventDefault on pointer events if needed.
			*/
			createAccountLink.addEventListener('pointerdown', navigateOnce, { passive: false });
			createAccountLink.addEventListener('click', navigateOnce, { passive: false });
		}
});

