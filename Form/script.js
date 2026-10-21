document.addEventListener('DOMContentLoaded', () => {
  initSlider(document.querySelector('[data-slider]'));
  initConsultForm(document.querySelector('.consult-form'));
});

/* ============================================================
   Слайдер услуг
   ============================================================ */
function initSlider(slider) {
  if (!slider) return;

  slider.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    const maxScroll = slider.scrollWidth - slider.clientWidth;
    if (maxScroll <= 0) return;

    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    const atStart = slider.scrollLeft <= 0 && delta < 0;
    const atEnd = slider.scrollLeft >= maxScroll - 1 && delta > 0;
    if (atStart || atEnd) return;

    event.preventDefault();
    slider.scrollLeft += delta;
  }, { passive: false });

  let isPointerDown = false;
  let isDragging = false;
  let startX = 0;
  let startScroll = 0;

  slider.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    isPointerDown = true;
    isDragging = false;
    startX = event.clientX;
    startScroll = slider.scrollLeft;
  });

  slider.addEventListener('pointermove', (event) => {
    if (!isPointerDown) return;
    const dx = event.clientX - startX;

    if (!isDragging && Math.abs(dx) > 5) {
      isDragging = true;
      slider.classList.add('is-dragging');
      slider.setPointerCapture(event.pointerId);
    }
    if (isDragging) slider.scrollLeft = startScroll - dx;
  });

  const stopDrag = (event) => {
    if (!isPointerDown) return;
    isPointerDown = false;
    slider.classList.remove('is-dragging');
    if (slider.hasPointerCapture(event.pointerId)) {
      slider.releasePointerCapture(event.pointerId);
    }
  };

  slider.addEventListener('pointerup', stopDrag);
  slider.addEventListener('pointercancel', stopDrag);

  slider.addEventListener('click', (event) => {
    if (isDragging) {
      event.preventDefault();
      event.stopPropagation();
      isDragging = false;
    }
  }, true);
}

/* ============================================================
   Форма записи: правила
   ============================================================ */
const LETTERS = 'A-Za-zА-Яа-яЁё';
const NAME_BAD_CHAR = new RegExp(`[^${LETTERS}\\s'’-]`);       // для проверки
const NAME_BAD_CHARS = new RegExp(`[^${LETTERS}\\s'’-]`, 'g');  // для очистки
const NAME_WORD = `[${LETTERS}]+(?:[-'’][${LETTERS}]+)*`;
const NAME_PATTERN = new RegExp(`^${NAME_WORD}(?:\\s${NAME_WORD}){1,3}$`);

// 7 + код (начинается с 3, 4, 8 или 9) + 9 цифр
const PHONE_PATTERN = /^7[3489]\d{9}$/;

function validateName(input) {
  const value = input.value.trim();

  if (!value) return 'Введите ФИО';
  if (/[A-Za-z]/.test(value) && /[А-Яа-яЁё]/.test(value)) {
    return 'Используйте буквы только одного алфавита';
  }

  const words = value.split(/\s+/);
  if (words.length < 2) return 'Укажите как минимум фамилию и имя';
  if (words.length > 4) return 'Слишком много слов';
  if (words.some((w) => w.replace(/[-'’]/g, '').length < 2)) {
    return 'Каждая часть ФИО — не менее 2 букв';
  }
  if (!NAME_PATTERN.test(value)) return 'Проверьте правильность написания';

  return '';
}

function validatePhone(input) {
  const digits = input.value.replace(/\D/g, '');

  if (!digits || digits === '7') return 'Введите номер телефона';
  if (digits.length < 11) return 'Номер введён не полностью';
  if (!PHONE_PATTERN.test(digits)) return 'Неверный код оператора или города';
  if (/^7(\d)\1{9}$/.test(digits)) return 'Похоже, номер указан неверно';

  return '';
}

function validateAgree(input) {
  return input.checked ? '' : 'Необходимо ваше согласие';
}

/* ---------- Вспомогательные функции ---------- */

// Каждое слово (и часть после дефиса) — с заглавной буквы
function normalizeName(value) {
  return value
    .trim()
    .replace(/[\s'’-]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s-])([a-zа-яё])/g, (_, sep, letter) => sep + letter.toUpperCase());
}

// 7XXXXXXXXXX → +7 (XXX) XXX-XX-XX
function formatPhone(digits) {
  if (!digits) return '';
  const d = digits.slice(1);
  let result = '+7';
  if (d.length > 0) result += ` (${d.slice(0, 3)}`;
  if (d.length > 3) result += `) ${d.slice(3, 6)}`;
  if (d.length > 6) result += `-${d.slice(6, 8)}`;
  if (d.length > 8) result += `-${d.slice(8, 10)}`;
  return result;
}

// Позиция курсора после N-й цифры в отформатированной строке
function caretAfterDigits(formatted, count) {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === count) return i + 1;
  }
  return formatted.length;
}

/* ============================================================
   Форма записи: логика
   ============================================================ */
function initConsultForm(form) {
  if (!form) return;

  const nameInput = form.elements.name;
  const phoneInput = form.elements.phone;
  const agreeInput = form.elements.agree;
  const submitBtn = form.querySelector('[type="submit"]');
  const status = form.querySelector('.consult-form__status');

  const validators = new Map([
    [nameInput, validateName],
    [phoneInput, validatePhone],
    [agreeInput, validateAgree],
  ]);

  const hintTimers = new WeakMap();
  const errorEl = (field) => document.getElementById(`${field.id}-error`);
  const isInvalid = (field) => field.getAttribute('aria-invalid') === 'true';

  function setError(field, message) {
    const el = errorEl(field);
    clearTimeout(hintTimers.get(field));
    el.classList.remove('is-hint');
    el.textContent = message;

    if (message) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }

  function validateField(field) {
    const message = validators.get(field)(field);
    setError(field, message);
    return !message;
  }

  // Короткая подсказка, когда символ заблокирован
  function flashHint(field, message) {
    const el = errorEl(field);
    el.textContent = message;
    el.classList.add('is-hint');

    clearTimeout(hintTimers.get(field));
    hintTimers.set(field, setTimeout(() => {
      el.classList.remove('is-hint');
      el.textContent = isInvalid(field) ? validators.get(field)(field) : '';
    }, 2000));
  }

  /* ---------- ФИО ---------- */
  nameInput.addEventListener('beforeinput', (event) => {
    if (event.inputType !== 'insertText' || !event.data) return;
    if (NAME_BAD_CHAR.test(event.data)) {
      event.preventDefault();
      flashHint(nameInput, /\d/.test(event.data)
        ? 'Цифры в ФИО недопустимы'
        : 'Только буквы, пробел и дефис');
    }
  });

  nameInput.addEventListener('input', (event) => {
    if (event.isComposing) return;
    nameInput.dataset.touched = 'true';

    const before = nameInput.value;
    const caret = nameInput.selectionStart ?? before.length;
    const cleaned = before
      .replace(NAME_BAD_CHARS, '')
      .replace(/^[\s'’-]+/, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/([-'’])[-'’]+/g, '$1');

    if (cleaned !== before) {
      nameInput.value = cleaned;
      const pos = Math.max(0, caret - (before.length - cleaned.length));
      nameInput.setSelectionRange(pos, pos);
    }

    if (isInvalid(nameInput)) validateField(nameInput);
  });

  nameInput.addEventListener('blur', () => {
    nameInput.value = normalizeName(nameInput.value);
    if (nameInput.dataset.touched) validateField(nameInput);
  });

  /* ---------- Телефон ---------- */
  let lastPhone = '';

  function applyPhone(digits, caretDigits) {
    const formatted = formatPhone(digits);
    phoneInput.value = formatted;
    lastPhone = formatted;
    if (document.activeElement === phoneInput) {
      const pos = caretAfterDigits(formatted, caretDigits);
      phoneInput.setSelectionRange(pos, pos);
    }
  }

  phoneInput.addEventListener('beforeinput', (event) => {
    if (event.inputType !== 'insertText' || !event.data) return;
    if (/\D/.test(event.data)) {
      event.preventDefault();
      flashHint(phoneInput, 'Можно вводить только цифры');
    }
  });

  phoneInput.addEventListener('input', (event) => {
    phoneInput.dataset.touched = 'true';

    const raw = phoneInput.value;
    const caret = phoneInput.selectionStart ?? raw.length;
    const type = event.inputType || '';
    let digits = raw.replace(/\D/g, '');
    let caretDigits = raw.slice(0, caret).replace(/\D/g, '').length;

    // Стёрли скобку, пробел или дефис — стираем соседнюю цифру
    if (type.startsWith('delete') && digits === lastPhone.replace(/\D/g, '')) {
      const forward = type === 'deleteContentForward';
      const index = forward ? caretDigits : caretDigits - 1;
      if (index >= 0 && index < digits.length) {
        digits = digits.slice(0, index) + digits.slice(index + 1);
        if (!forward) caretDigits -= 1;
      }
    }

    // Приводим к формату 7XXXXXXXXXX
    if (digits && digits[0] !== '7') {
      if (digits[0] === '8') {
        digits = `7${digits.slice(1)}`;
      } else {
        digits = `7${digits}`;
        caretDigits += 1;
      }
    }
    digits = digits.slice(0, 11);
    if (type.startsWith('delete') && digits === '7') digits = '';

    applyPhone(digits, Math.min(caretDigits, digits.length));

    if (isInvalid(phoneInput)) validateField(phoneInput);
  });

  phoneInput.addEventListener('focus', () => {
    if (!phoneInput.value) applyPhone('7', 1);
  });

  phoneInput.addEventListener('blur', () => {
    if (phoneInput.value.replace(/\D/g, '') === '7') {
      phoneInput.value = '';
      lastPhone = '';
    }
    if (phoneInput.dataset.touched) validateField(phoneInput);
  });

  /* ---------- Согласие ---------- */
  agreeInput.addEventListener('change', () => {
    if (isInvalid(agreeInput) || !agreeInput.checked) validateField(agreeInput);
  });

  /* ---------- Отправка ---------- */
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';
    status.classList.remove('is-error');

    nameInput.value = normalizeName(nameInput.value);

    const invalid = [...validators.keys()].filter((field) => !validateField(field));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    const payload = {
      name: nameInput.value,
      phone: `+${phoneInput.value.replace(/\D/g, '')}`, // +79991234567
      agree: true,
    };

    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');

    try {
      // Замените на реальный запрос:
      // const response = await fetch('/api/consultation', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload),
      // });
      // if (!response.ok) throw new Error(response.statusText);
      console.log('Отправка:', payload);
      await new Promise((resolve) => setTimeout(resolve, 600)); // имитация запроса

      status.textContent = 'Спасибо! Мы свяжемся с вами в ближайшее время.';
      form.reset();
      lastPhone = '';
      validators.forEach((_, field) => {
        setError(field, '');
        delete field.dataset.touched;
      });
    } catch (error) {
      status.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз.';
      status.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
    }
  });
}
