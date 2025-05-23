// Make jsPDF available globally for html2canvas
if (window.jspdf && !window.jsPDF) {
  // Check if jspdf is on window and jsPDF is not
  window.jsPDF = window.jspdf.jsPDF;
}

document.addEventListener('DOMContentLoaded', function () {
  // --- FUNCTION DEFINITIONS ---
  function applyMasks() {
    if (typeof VMasker === 'undefined') {
      console.warn('VMasker library not loaded.');
      return;
    }
    VMasker(document.querySelectorAll('.date-mask')).maskPattern('99/99/9999');
    VMasker(document.querySelectorAll('.time-mask')).maskPattern('99:99');
    VMasker(document.querySelectorAll('.cpf-mask')).maskPattern(
      '999.999.999-99',
    );
    document.querySelectorAll('.phone-mask').forEach(function (input) {
      var phoneMask = ['(99) 9999-9999', '(99) 99999-9999'];
      VMasker(input).maskPattern(phoneMask[0]);
      input.addEventListener(
        'input',
        maskHandler.bind(undefined, phoneMask, 14),
        false,
      );
    });
    VMasker(document.querySelectorAll('.money-mask')).maskMoney({
      precision: 2,
      separator: ',',
      delimiter: '.',
      unit: 'R$',
      zeroCents: true,
    });
  }

  var maskHandler = function (masks, maxInputLength, event) {
    if (typeof VMasker === 'undefined') return;
    var c = event.target;
    var v = c.value.replace(/\D/g, '');
    var m = v.length > 10 ? 1 : 0;
    VMasker(c).unMask();
    VMasker(c).maskPattern(masks[m]);
    c.value = VMasker.toPattern(v, masks[m]);
  };

  function initializeSignaturePad(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error('Canvas element not found:', canvasId);
      return null;
    }
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    // Store the resize function to be callable
    const resizeCanvasFunc = function () {
      const style = getComputedStyle(canvas);
      const newWidth = parseInt(style.width, 10);
      const newHeight = parseInt(style.height, 10);

      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        // Save current drawing
        let tempImgData = null;
        if (canvas.width > 0 && canvas.height > 0) {
          // Only if canvas had dimensions
          try {
            tempImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          } catch (e) {
            console.warn('Could not get image data before resize', e);
          }
        }

        canvas.width = newWidth;
        canvas.height = newHeight;

        // Restore drawing
        if (tempImgData) {
          ctx.putImageData(tempImgData, 0, 0);
        }
      }

      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvasFunc, 150); // Debounce
    });

    // Initial resize needs to happen after the element is in the DOM and sized
    // Use a small timeout or requestAnimationFrame for reliability
    // Ensure this is called when the canvas becomes visible if it starts hidden
    setTimeout(resizeCanvasFunc, 50); // Small delay for initial sizing

    function getMousePos(canvasDom, event) {
      var rect = canvasDom.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    function getTouchPos(canvasDom, touchEvent) {
      var rect = canvasDom.getBoundingClientRect();
      return {
        x: touchEvent.touches[0].clientX - rect.left,
        y: touchEvent.touches[0].clientY - rect.top,
      };
    }
    function startDrawing(e) {
      drawing = true;
      const pos = e.touches ? getTouchPos(canvas, e) : getMousePos(canvas, e);
      [lastX, lastY] = [pos.x, pos.y];
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
    }
    function draw(e) {
      if (!drawing) return;
      e.preventDefault();
      const pos = e.touches ? getTouchPos(canvas, e) : getMousePos(canvas, e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      [lastX, lastY] = [pos.x, pos.y];
    }
    function stopDrawing() {
      if (!drawing) return;
      drawing = false;
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    return {
      clear: () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.classList.remove('is-invalid');
        const feedback = document.querySelector(
          `.invalid-canvas-feedback[data-feedback-for="${canvasId}"]`,
        );
        if (feedback) feedback.style.display = 'none';
      },
      isEmpty: () => {
        if (canvas.width === 0 || canvas.height === 0) return true;
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            if (imageData.data[i + 3] > 0) {
              return false;
            }
          }
        } catch (e) {
          console.error(
            'Error reading canvas image data for isEmpty check:',
            e,
          );
          return true;
        }
        return true;
      },
      resize: resizeCanvasFunc, // Expose resize function
    };
  }

  function setupRadioGroupFeedback() {
    const radioGroups = {};
    document
      .querySelectorAll('input[type="radio"][required]')
      .forEach((radio) => {
        if (!radioGroups[radio.name]) {
          radioGroups[radio.name] = [];
        }
        radioGroups[radio.name].push(radio);
      });

    for (const groupName in radioGroups) {
      const radiosInGroup = radioGroups[groupName];
      const feedbackEl = document.querySelector(
        `.radio-group-feedback[data-feedback-for="${groupName}"]`,
      );

      if (!feedbackEl) {
        console.warn(
          `Feedback element not found for radio group: ${groupName}`,
        );
        continue;
      }

      radiosInGroup.forEach((radio) => {
        radio.addEventListener('change', function () {
          if (this.checked) {
            feedbackEl.innerHTML =
              '<i class="bi bi-check-circle-fill"></i> Selecionado';
            feedbackEl.className = 'radio-group-feedback text-success d-block';
          }
        });
      });
    }
  }

  async function generatePDF() {
    const formToPrint = document.getElementById('formToPrint');
    const navigationContainer = document.getElementById('navigationContainer');
    const clearSignatureButtons = document.querySelectorAll(
      '.btn-clear-signature',
    );
    const submitButton = document.getElementById('submitBtn');
    const originalButtonText = submitButton.innerHTML;
    const formStepsForPdf = document.querySelectorAll('.form-step');

    formStepsForPdf.forEach((step) => (step.style.display = 'block'));

    if (navigationContainer) navigationContainer.classList.add('hide-for-pdf');
    clearSignatureButtons.forEach((btn) => btn.classList.add('hide-for-pdf'));
    submitButton.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Gerando PDF...';
    submitButton.disabled = true;

    await new Promise((resolve) => setTimeout(resolve, 250));

    try {
      const canvasOutput = await html2canvas(formToPrint, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvasOutput.toDataURL('image/png');

      if (typeof jsPDF === 'undefined') {
        alert(
          'Erro: A biblioteca jsPDF não está carregada. O PDF não pode ser gerado.',
        );
        throw new Error('jsPDF not loaded');
      }
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pdfWidth - margin * 2;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight - margin * 2;

      while (heightLeft > 0) {
        position = margin - (imgHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight - margin * 2;
      }
      pdf.save('Formulario-SignatureLashes.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Ocorreu um erro ao gerar o PDF. Por favor, tente novamente.');
    } finally {
      if (navigationContainer)
        navigationContainer.classList.remove('hide-for-pdf');
      clearSignatureButtons.forEach((btn) =>
        btn.classList.remove('hide-for-pdf'),
      );
      submitButton.innerHTML = originalButtonText;
      submitButton.disabled = false;
      showStep(currentStep);
    }
  }

  function saveFormState() {
    const formData = {};
    document
      .querySelectorAll(
        '#signatureLashesForm input, #signatureLashesForm textarea, #signatureLashesForm select',
      )
      .forEach((input) => {
        if (input.type === 'radio') {
          if (input.checked) formData[input.name] = input.value;
        } else if (input.type === 'checkbox') {
          if (!formData[input.name]) formData[input.name] = [];
          if (input.checked) formData[input.name].push(input.value);
        } else if (input.id) {
          formData[input.id] = input.value;
        }
      });

    if (localDataSignaturePad && !localDataSignaturePad.isEmpty()) {
      formData['localDataCanvas'] = document
        .getElementById('localDataCanvas')
        .toDataURL();
    }
    if (assinaturaSignaturePad && !assinaturaSignaturePad.isEmpty()) {
      formData['assinaturaCanvas'] = document
        .getElementById('assinaturaCanvas')
        .toDataURL();
    }

    localStorage.setItem('signatureFormAutosave', JSON.stringify(formData));
  }

  function loadFormState() {
    const savedData = localStorage.getItem('signatureFormAutosave');
    if (!savedData) return;

    const formData = JSON.parse(savedData);
    for (const key in formData) {
      if (key === 'localDataCanvas' || key === 'assinaturaCanvas') {
        const canvas = document.getElementById(key);
        if (canvas && formData[key]) {
          const img = new Image();
          img.onload = function () {
            const ctx = canvas.getContext('2d');
            // Ensure canvas is sized before drawing
            if (canvas.width > 0 && canvas.height > 0) {
              ctx.drawImage(img, 0, 0);
            } else {
              // If canvas not sized yet, wait a bit and try again or rely on resize
              setTimeout(() => {
                if (canvas.width > 0 && canvas.height > 0)
                  ctx.drawImage(img, 0, 0);
              }, 200);
            }
          };
          img.src = formData[key];
        }
      } else {
        const input =
          document.getElementById(key) ||
          document.querySelector(`[name="${key}"]`);
        if (input) {
          if (input.type === 'radio') {
            const radioToSelect = document.querySelector(
              `[name="${key}"][value="${formData[key]}"]`,
            );
            if (radioToSelect) {
              radioToSelect.checked = true;
              radioToSelect.dispatchEvent(new Event('change'));
            }
          } else if (input.type === 'checkbox') {
            if (Array.isArray(formData[key])) {
              formData[key].forEach((value) => {
                const chk = document.querySelector(
                  `[name="${key}"][value="${value}"]`,
                );
                if (chk) chk.checked = true;
              });
            }
          } else {
            input.value = formData[key];
          }
        }
      }
    }
    console.log('Form state loaded.');
  }

  // --- INITIALIZATIONS & EVENT LISTENERS ---
  applyMasks();
  setupRadioGroupFeedback();

  const localDataSignaturePad = initializeSignaturePad('localDataCanvas');
  const assinaturaSignaturePad = initializeSignaturePad('assinaturaCanvas');

  document.querySelectorAll('.btn-clear-signature').forEach((button) => {
    button.addEventListener('click', function () {
      const canvasId = this.dataset.canvas;
      if (canvasId === 'localDataCanvas' && localDataSignaturePad) {
        localDataSignaturePad.clear();
      } else if (canvasId === 'assinaturaCanvas' && assinaturaSignaturePad) {
        assinaturaSignaturePad.clear();
      }
      saveFormState();
    });
  });

  const formSteps = [...document.querySelectorAll('.form-step')];
  const stepperItems = [...document.querySelectorAll('.stepper-item')];
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const submitBtn = document.getElementById('submitBtn');
  let currentStep = 0;

  function updateStepper() {
    stepperItems.forEach((item, index) => {
      item.classList.remove('active', 'completed');
      if (index < currentStep) {
        item.classList.add('completed');
      } else if (index === currentStep) {
        item.classList.add('active');
      }
    });
  }

  function showStep(stepIndex) {
    formSteps.forEach((step, index) => {
      step.classList.toggle('active', index === stepIndex);
    });
    prevBtn.classList.toggle('d-none', stepIndex === 0);
    nextBtn.classList.toggle('d-none', stepIndex === formSteps.length - 1);
    submitBtn.classList.toggle('d-none', stepIndex !== formSteps.length - 1);
    updateStepper();
    window.scrollTo(0, 0);

    // If showing step 3 (index 2), ensure canvases are resized
    if (stepIndex === 2) {
      if (
        localDataSignaturePad &&
        typeof localDataSignaturePad.resize === 'function'
      ) {
        setTimeout(() => localDataSignaturePad.resize(), 50);
      }
      if (
        assinaturaSignaturePad &&
        typeof assinaturaSignaturePad.resize === 'function'
      ) {
        setTimeout(() => assinaturaSignaturePad.resize(), 50);
      }
    }
  }

  function validateCurrentStepFields(stepIndex) {
    const currentStepEl = formSteps[stepIndex];
    let isStepValid = true;
    currentStepEl
      .querySelectorAll('input[required], select[required], textarea[required]')
      .forEach((input) => {
        if (!input.checkValidity()) {
          isStepValid = false;
        }
      });
    const radioGroupsInStep = {};
    currentStepEl
      .querySelectorAll('input[type="radio"][required]')
      .forEach((radio) => {
        radioGroupsInStep[radio.name] = true;
      });
    for (const groupName in radioGroupsInStep) {
      if (!document.querySelector(`input[name="${groupName}"]:checked`)) {
        isStepValid = false;
        const feedbackEl = document.querySelector(
          `.radio-group-feedback[data-feedback-for="${groupName}"]`,
        );
        if (feedbackEl && !feedbackEl.classList.contains('text-success')) {
          feedbackEl.innerHTML =
            '<i class="bi bi-exclamation-circle-fill"></i> Por favor, selecione uma opção.';
          feedbackEl.className = 'radio-group-feedback text-danger d-block';
        }
      }
    }
    if (currentStepEl.contains(document.getElementById('localDataCanvas'))) {
      const localCanvas = document.getElementById('localDataCanvas');
      const localFeedback = document.querySelector(
        '.invalid-canvas-feedback[data-feedback-for="localDataCanvas"]',
      );
      if (localDataSignaturePad && localDataSignaturePad.isEmpty()) {
        isStepValid = false;
        if (localCanvas) localCanvas.classList.add('is-invalid');
        if (localFeedback) localFeedback.style.display = 'block';
      } else {
        if (localCanvas) localCanvas.classList.remove('is-invalid');
        if (localFeedback) localFeedback.style.display = 'none';
      }
    }
    if (currentStepEl.contains(document.getElementById('assinaturaCanvas'))) {
      const sigCanvas = document.getElementById('assinaturaCanvas');
      const sigFeedback = document.querySelector(
        '.invalid-canvas-feedback[data-feedback-for="assinaturaCanvas"]',
      );
      if (assinaturaSignaturePad && assinaturaSignaturePad.isEmpty()) {
        isStepValid = false;
        if (sigCanvas) sigCanvas.classList.add('is-invalid');
        if (sigFeedback) sigFeedback.style.display = 'block';
      } else {
        if (sigCanvas) sigCanvas.classList.remove('is-invalid');
        if (sigFeedback) sigFeedback.style.display = 'none';
      }
    }
    return isStepValid;
  }

  nextBtn.addEventListener('click', () => {
    document
      .getElementById('signatureLashesForm')
      .classList.add('was-validated');
    if (validateCurrentStepFields(currentStep)) {
      currentStep++;
      showStep(currentStep);
      saveFormState();
    } else {
      console.log('Validation failed for step ' + (currentStep + 1));
    }
  });

  prevBtn.addEventListener('click', () => {
    currentStep--;
    showStep(currentStep);
  });

  showStep(currentStep);

  document
    .getElementById('signatureLashesForm')
    .addEventListener('change', saveFormState);
  document
    .getElementById('signatureLashesForm')
    .addEventListener('keyup', saveFormState);
  ['localDataCanvas', 'assinaturaCanvas'].forEach((id) => {
    const canvas = document.getElementById(id);
    if (canvas) {
      canvas.addEventListener('mouseup', saveFormState);
      canvas.addEventListener('touchend', saveFormState);
    }
  });

  loadFormState();

  const form = document.getElementById('signatureLashesForm');
  const confirmationModalElement = document.getElementById('confirmationModal');
  const confirmationModal = confirmationModalElement
    ? new bootstrap.Modal(confirmationModalElement)
    : null;
  const modalBodyContent = document.getElementById('modalBodyContent');

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    event.stopPropagation();

    let allStepsValid = true;
    for (let i = 0; i < formSteps.length; i++) {
      if (!validateCurrentStepFields(i)) {
        allStepsValid = false;
      }
    }
    form.classList.add('was-validated');

    if (!form.checkValidity()) {
      // This is Bootstrap's overall check
      allStepsValid = false;
    }

    if (!allStepsValid) {
      let errorMessage =
        'Por favor, corrija os erros no formulário antes de salvar. Verifique todas as etapas.';
      modalBodyContent.textContent = errorMessage;
      modalBodyContent.classList.remove('text-success');
      modalBodyContent.classList.add('text-danger');
      if (confirmationModal) confirmationModal.show();
    } else {
      console.log('Formulário válido. Gerando PDF...');
      await generatePDF();

      modalBodyContent.textContent =
        'PDF gerado e download iniciado com sucesso!';
      modalBodyContent.classList.add('text-success');
      modalBodyContent.classList.remove('text-danger');
      if (confirmationModal) confirmationModal.show();

      localStorage.removeItem('signatureFormAutosave');
    }
  });
});
