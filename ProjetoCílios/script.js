// Make jsPDF available globally for html2canvas if not already via UMD
if (window.jspdf && !window.jsPDF) {
  window.jsPDF = window.jspdf.jsPDF;
}

function applyMasks() {
  if (typeof VMasker === 'undefined') {
    console.warn('VMasker library not loaded.');
    return;
  }
  VMasker(document.querySelectorAll('.date-mask')).maskPattern('99/99/9999');
  VMasker(document.querySelectorAll('.time-mask')).maskPattern('99:99');
  VMasker(document.querySelectorAll('.cpf-mask')).maskPattern('999.999.999-99');
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
    // console.error("Canvas element not found:", canvasId);
    return null;
  }
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let lastX = 0;
  let lastY = 0;

  function resizeCanvas() {
    // Make canvas responsive by setting its internal resolution based on its CSS display size
    const style = getComputedStyle(canvas);
    const newWidth = parseInt(style.width, 10);
    const newHeight = parseInt(style.height, 10);

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
      canvas.width = newWidth;
      canvas.height = newHeight;
    }

    // Re-apply drawing styles after resize, as canvas context resets
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  // Debounce resize function
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resizeCanvas, 100); // Adjust delay as needed
  });

  // Initial resize needs to happen after the element is in the DOM and sized
  // Use a small timeout or requestAnimationFrame for reliability
  if (document.readyState === 'complete') {
    setTimeout(resizeCanvas, 0);
  } else {
    window.addEventListener('load', () => setTimeout(resizeCanvas, 0));
  }

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
      // Check if canvas has non-transparent pixels
      if (canvas.width === 0 || canvas.height === 0) return true; // Canvas not ready or invisible
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          if (imageData.data[i + 3] > 0) {
            // Check alpha channel
            return false; // Found a non-transparent pixel
          }
        }
      } catch (e) {
        // console.error("Error reading canvas image data (possibly due to taint or zero size):", e);
        return true; // Assume empty on error to prevent blocking submission if canvas isn't ready
      }
      return true; // All pixels are transparent
    },
  };
}

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
  });
});

async function generatePDF() {
  const formToPrint = document.getElementById('formToPrint');
  const submitButtonContainer = document.getElementById(
    'submitButtonContainer',
  );
  const clearSignatureButtons = document.querySelectorAll(
    '.btn-clear-signature',
  );
  const btnSalvar = document.getElementById('btnSalvarFormulario');
  const originalButtonText = btnSalvar.innerHTML;

  if (submitButtonContainer)
    submitButtonContainer.classList.add('hide-for-pdf');
  clearSignatureButtons.forEach((btn) => btn.classList.add('hide-for-pdf'));
  btnSalvar.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Gerando PDF...';
  btnSalvar.disabled = true;

  // Ensure canvas drawings are fully rendered
  await new Promise((resolve) => setTimeout(resolve, 200)); // Increased delay slightly

  try {
    const canvasOutput = await html2canvas(formToPrint, {
      scale: 2,
      useCORS: true,
      logging: false,
      onclone: (document) => {
        // This is a good place to ensure styles are applied if needed before capture
        // For example, if some styles depend on :hover or other states not active.
      },
    });
    const imgData = canvasOutput.toDataURL('image/png');

    // Check if jsPDF is loaded
    if (
      typeof jsPDF === 'undefined' &&
      typeof window.jspdf.jsPDF !== 'undefined'
    ) {
      window.jsPDF = window.jspdf.jsPDF; // Ensure global jsPDF is available
    }
    if (typeof jsPDF === 'undefined') {
      console.error('jsPDF library is not loaded correctly!');
      alert(
        'Erro: A biblioteca jsPDF não está carregada. O PDF não pode ser gerado.',
      );
      throw new Error('jsPDF not loaded');
    }

    const pdf = new jsPDF({
      // Use the globally available jsPDF
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
    });

    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const margin = 10; // 10mm margin
    const imgWidth = pdfWidth - margin * 2;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight - margin * 2;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight - margin * 2;
    }

    pdf.save('Formulario-SignatureLashes.pdf');
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    alert('Ocorreu um erro ao gerar o PDF. Por favor, tente novamente.');
  } finally {
    if (submitButtonContainer)
      submitButtonContainer.classList.remove('hide-for-pdf');
    clearSignatureButtons.forEach((btn) =>
      btn.classList.remove('hide-for-pdf'),
    );
    btnSalvar.innerHTML = originalButtonText;
    btnSalvar.disabled = false;
  }
}

// Radio button group feedback logic
function setupRadioGroupFeedback() {
  const radioGroups = {};
  // Find all radio buttons with 'required' attribute to identify groups needing feedback
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
      // console.warn(`Feedback element not found for radio group: ${groupName}`);
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

// Bootstrap form validation and main logic
(function () {
  'use strict';

  // Wait for the DOM to be fully loaded before initializing scripts that depend on it
  document.addEventListener('DOMContentLoaded', function () {
    setupRadioGroupFeedback();
    applyMasks();

    var forms = document.querySelectorAll('.needs-validation');
    var confirmationModalElement = document.getElementById('confirmationModal');
    var confirmationModal = confirmationModalElement
      ? new bootstrap.Modal(confirmationModalElement)
      : null;
    var modalBodyContent = document.getElementById('modalBodyContent');

    if (!forms.length || !confirmationModal || !modalBodyContent) {
      // console.error("Essential form elements or modal not found. Validation and submission might not work.");
      return;
    }

    Array.prototype.slice.call(forms).forEach(function (form) {
      form.addEventListener(
        'submit',
        async function (event) {
          event.preventDefault();
          event.stopPropagation();

          let isBootstrapValid = form.checkValidity();
          let signaturesValid = true;
          let radioGroupsValid = true;
          let overallErrorMessage =
            'Por favor, corrija os erros no formulário antes de salvar.';

          // Validate Signature Pads
          const localDataCanvasEl = document.getElementById('localDataCanvas');
          const localDataFeedbackEl = document.querySelector(
            '.invalid-canvas-feedback[data-feedback-for="localDataCanvas"]',
          );
          if (localDataSignaturePad && localDataSignaturePad.isEmpty()) {
            signaturesValid = false;
            if (localDataCanvasEl)
              localDataCanvasEl.classList.add('is-invalid');
            if (localDataFeedbackEl)
              localDataFeedbackEl.style.display = 'block';
          } else if (localDataSignaturePad) {
            if (localDataCanvasEl)
              localDataCanvasEl.classList.remove('is-invalid');
            if (localDataFeedbackEl) localDataFeedbackEl.style.display = 'none';
          }

          const assinaturaCanvasEl =
            document.getElementById('assinaturaCanvas');
          const assinaturaFeedbackEl = document.querySelector(
            '.invalid-canvas-feedback[data-feedback-for="assinaturaCanvas"]',
          );
          if (assinaturaSignaturePad && assinaturaSignaturePad.isEmpty()) {
            signaturesValid = false;
            if (assinaturaCanvasEl)
              assinaturaCanvasEl.classList.add('is-invalid');
            if (assinaturaFeedbackEl)
              assinaturaFeedbackEl.style.display = 'block';
          } else if (assinaturaSignaturePad) {
            if (assinaturaCanvasEl)
              assinaturaCanvasEl.classList.remove('is-invalid');
            if (assinaturaFeedbackEl)
              assinaturaFeedbackEl.style.display = 'none';
          }

          // Validate Radio Button Groups (on submit)
          document
            .querySelectorAll('input[type="radio"][required]')
            .forEach((radioInput) => {
              const groupName = radioInput.name;
              const feedbackEl = document.querySelector(
                `.radio-group-feedback[data-feedback-for="${groupName}"]`,
              );
              const groupRadios = form.elements[groupName];
              let isGroupChecked = false;
              if (groupRadios && groupRadios.value) {
                isGroupChecked = true;
              }

              if (!isGroupChecked && feedbackEl) {
                radioGroupsValid = false; // Mark that at least one radio group is invalid
                feedbackEl.innerHTML =
                  '<i class="bi bi-exclamation-circle-fill"></i> Por favor, selecione uma opção.';
                feedbackEl.className =
                  'radio-group-feedback text-danger d-block';
              } else if (isGroupChecked && feedbackEl) {
                // If checked, ensure it shows success (change listener should handle this, but good to confirm)
                if (!feedbackEl.classList.contains('text-success')) {
                  feedbackEl.innerHTML =
                    '<i class="bi bi-check-circle-fill"></i> Selecionado';
                  feedbackEl.className =
                    'radio-group-feedback text-success d-block';
                }
              }
            });

          form.classList.add('was-validated');

          if (!isBootstrapValid || !signaturesValid || !radioGroupsValid) {
            let errorMessages = [];
            // Bootstrap validation errors are shown directly on fields.
            // We add specific messages for custom validations (signatures, radio groups).
            if (!signaturesValid)
              errorMessages.push('preencha as assinaturas obrigatórias');
            if (!radioGroupsValid)
              errorMessages.push(
                'selecione todas as opções obrigatórias nas perguntas',
              );

            if (errorMessages.length > 0) {
              overallErrorMessage =
                'Por favor, ' +
                errorMessages.join(' e ') +
                '. Verifique também outros campos destacados.';
            } else {
              overallErrorMessage = 'Por favor, corrija os campos destacados.';
            }

            modalBodyContent.textContent = overallErrorMessage;
            modalBodyContent.classList.remove('text-success');
            modalBodyContent.classList.add('text-danger');
            confirmationModal.show();
          } else {
            console.log('Formulário válido. Gerando PDF...');
            await generatePDF();

            modalBodyContent.textContent =
              'PDF gerado e download iniciado com sucesso!';
            modalBodyContent.classList.add('text-success');
            modalBodyContent.classList.remove('text-danger');
            confirmationModal.show();
          }
        },
        false,
      );
    });
  }); // End DOMContentLoaded
})();
