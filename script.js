// Make jsPDF available globally for html2canvas
if (window.jspdf && !window.jsPDF) { 
    window.jsPDF = window.jspdf.jsPDF;
}

document.addEventListener('DOMContentLoaded', function() {
   
   // --- FUNCTION DEFINITIONS ---
   function applyMasks() {
       if (typeof VMasker === "undefined") {
           // console.warn("VMasker library not loaded.");
           return;
       }
       VMasker(document.querySelectorAll(".date-mask")).maskPattern("99/99/9999");
       VMasker(document.querySelectorAll(".time-mask")).maskPattern("99:99");
       VMasker(document.querySelectorAll(".cpf-mask")).maskPattern("999.999.999-99");
       document.querySelectorAll(".phone-mask").forEach(function(input) {
           var phoneMask = ['(99) 9999-9999', '(99) 99999-9999'];
           VMasker(input).maskPattern(phoneMask[0]);
           input.addEventListener('input', maskHandler.bind(undefined, phoneMask, 14), false);
       });
       VMasker(document.querySelectorAll(".money-mask")).maskMoney({
           precision: 2, separator: ',', delimiter: '.', unit: 'R$', zeroCents: true
       });
   }

   var maskHandler = function(masks, maxInputLength, event) {
       if (typeof VMasker === "undefined") return;
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
       
       const resizeCanvasFunc = function() {
           const style = getComputedStyle(canvas);
           const newWidth = parseInt(style.width, 10);
           const newHeight = parseInt(style.height, 10);

           if (canvas.width !== newWidth || canvas.height !== newHeight) {
               let tempImgData = null;
               if (canvas.width > 0 && canvas.height > 0 && !isCanvasBlank(ctx, canvas.width, canvas.height)) { 
                  try { tempImgData = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch(e) { console.warn("Could not get image data before resize for " + canvasId, e)}
               }
               
               canvas.width = newWidth;
               canvas.height = newHeight;
               
               if (tempImgData) {
                   ctx.putImageData(tempImgData, 0, 0);
               }
           }
           
           ctx.strokeStyle = '#000'; 
           ctx.lineWidth = 2;       
           ctx.lineCap = 'round';   
           ctx.lineJoin = 'round';  
       }
       
       let resizeTimeout;
       window.addEventListener('resize', () => {
           clearTimeout(resizeTimeout);
           resizeTimeout = setTimeout(resizeCanvasFunc, 150); 
       });
       
       // Initial resize called when the step is shown
       // setTimeout(resizeCanvasFunc, 50); 

       function getMousePos(canvasDom, event) {
           var rect = canvasDom.getBoundingClientRect();
           return { x: event.clientX - rect.left, y: event.clientY - rect.top };
       }
       function getTouchPos(canvasDom, touchEvent) {
           var rect = canvasDom.getBoundingClientRect();
           return { x: touchEvent.touches[0].clientX - rect.left, y: touchEvent.touches[0].clientY - rect.top };
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
       
       const isCanvasBlank = (context,cWidth,cHeight) => {
           if (cWidth === 0 || cHeight === 0) return true;
           try {
               const imageData = context.getImageData(0, 0, cWidth, cHeight);
               for (let i = 0; i < imageData.data.length; i += 4) {
                   if (imageData.data[i+3] > 0) { return false; }
               }
           } catch (e) { return true; }
           return true;
       };

       return {
           clear: () => {
               ctx.clearRect(0, 0, canvas.width, canvas.height);
               canvas.classList.remove('is-invalid'); 
               const feedback = document.querySelector(`.invalid-canvas-feedback[data-feedback-for="${canvasId}"]`);
               if (feedback) feedback.style.display = 'none';
           },
           isEmpty: () => isCanvasBlank(ctx, canvas.width, canvas.height),
           resize: resizeCanvasFunc 
       };
   }

   function setupRadioGroupFeedback() {
       const radioGroups = {};
       document.querySelectorAll('input[type="radio"][required]').forEach(radio => {
           if (!radioGroups[radio.name]) {
               radioGroups[radio.name] = [];
           }
           radioGroups[radio.name].push(radio);
       });

       for (const groupName in radioGroups) {
           const radiosInGroup = radioGroups[groupName];
           const feedbackEl = document.querySelector(`.radio-group-feedback[data-feedback-for="${groupName}"]`);
           
           if (!feedbackEl) {
               // console.warn(`Feedback element not found for radio group: ${groupName}`);
               continue; 
           }

           radiosInGroup.forEach(radio => {
               radio.addEventListener('change', function() {
                   if (this.checked) {
                       feedbackEl.innerHTML = '<i class="bi bi-check-circle-fill"></i> Selecionado';
                       feedbackEl.className = 'radio-group-feedback text-success d-block';
                   }
               });
           });
       }
   }

   async function generatePDF() {
       const formElementForPdf = document.getElementById('signatureLashesForm'); 
       const formContainerForPdf = document.getElementById('formToPrintContainer');
       const submitButton = document.getElementById('submitBtn'); 
       const originalButtonText = submitButton.innerHTML;

       window.scrollTo(0, 0);

       formContainerForPdf.classList.add('printing-pdf'); 
       
       submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Gerando PDF...';
       submitButton.disabled = true;
       
       // Ensure all steps are rendered and canvases are sized before capture
       const allFormSteps = document.querySelectorAll('.form-step');
       allFormSteps.forEach(step => step.style.display = 'block'); // Make all visible
       if (localDataSignaturePad && typeof localDataSignaturePad.resize === 'function') localDataSignaturePad.resize();
       if (assinaturaSignaturePad && typeof assinaturaSignaturePad.resize === 'function') assinaturaSignaturePad.resize();
       
       await new Promise(resolve => setTimeout(resolve, 400)); 

       try {
           if (typeof jsPDF === 'undefined') { 
               alert("Erro: A biblioteca jsPDF não está carregada. O PDF não pode ser gerado.");
               throw new Error('jsPDF not loaded');
           }
           const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
           const margin = 10;
           const pdfWidth = pdf.internal.pageSize.getWidth();
           const usablePdfWidth = pdfWidth - (margin * 2);
           let currentYPositionInPdf = margin;
           const spaceBetweenSteps = 5; 

           for (let i = 0; i < allFormSteps.length; i++) {
               const stepElement = allFormSteps[i];
               
               // Double check canvas resize for the step containing them
               if (stepElement.contains(document.getElementById('localDataCanvas'))) {
                    if (localDataSignaturePad && typeof localDataSignaturePad.resize === 'function') localDataSignaturePad.resize();
                    if (assinaturaSignaturePad && typeof assinaturaSignaturePad.resize === 'function') assinaturaSignaturePad.resize();
                    await new Promise(resolve => setTimeout(resolve, 100)); 
               }


               const canvasOutput = await html2canvas(stepElement, { 
                   scale: 2, 
                   useCORS: true, 
                   logging: false,
                   width: stepElement.offsetWidth, 
                   height: stepElement.offsetHeight,
                   x: 0, 
                   y: 0,
                   scrollX: -stepElement.scrollLeft, 
                   scrollY: -stepElement.scrollTop,
                   windowWidth: document.documentElement.scrollWidth, 
                   windowHeight: document.documentElement.scrollHeight
               });
               const imgData = canvasOutput.toDataURL('image/png');
               const imgProps = pdf.getImageProperties(imgData);
               const imgHeightInPdf = (imgProps.height * usablePdfWidth) / imgProps.width;

               if (currentYPositionInPdf !== margin && (currentYPositionInPdf + imgHeightInPdf > (pdf.internal.pageSize.getHeight() - margin))) {
                   pdf.addPage();
                   currentYPositionInPdf = margin; 
               }

               pdf.addImage(imgData, 'PNG', margin, currentYPositionInPdf, usablePdfWidth, imgHeightInPdf);
               currentYPositionInPdf += imgHeightInPdf + spaceBetweenSteps;
           }

           pdf.save('Formulario-SignatureLashes.pdf');

       } catch (error) {
           console.error("Erro ao gerar PDF:", error);
           alert("Ocorreu um erro ao gerar o PDF. Por favor, tente novamente.");
       } finally {
           formContainerForPdf.classList.remove('printing-pdf');
           submitButton.innerHTML = originalButtonText;
           submitButton.disabled = false;
           showStep(currentStep); 
       }
   }
   
   function saveFormState() {
       const formData = {};
       document.querySelectorAll('#signatureLashesForm input, #signatureLashesForm textarea, #signatureLashesForm select').forEach(input => {
           if (input.type === 'radio') {
               if (input.checked) formData[input.name] = input.value;
           } else if (input.type === 'checkbox') {
               if (!formData[input.name]) formData[input.name] = [];
               if (input.checked) formData[input.name].push(input.value);
           } else if(input.id) {
               formData[input.id] = input.value;
           }
       });
       
       if (localDataSignaturePad && !localDataSignaturePad.isEmpty()) {
           try { formData['localDataCanvas'] = document.getElementById('localDataCanvas').toDataURL(); } catch(e) { console.warn("Error saving localDataCanvas toDataURL", e); }
       }
       if (assinaturaSignaturePad && !assinaturaSignaturePad.isEmpty()) {
            try { formData['assinaturaCanvas'] = document.getElementById('assinaturaCanvas').toDataURL(); } catch(e) { console.warn("Error saving assinaturaCanvas toDataURL", e); }
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
                   img.onload = function() {
                       const ctx = canvas.getContext('2d');
                       const signaturePadInstance = (key === 'localDataCanvas') ? localDataSignaturePad : assinaturaSignaturePad;
                       if(signaturePadInstance && typeof signaturePadInstance.resize === 'function') {
                           signaturePadInstance.resize(); 
                       }
                       setTimeout(() => { 
                          if (canvas.width > 0 && canvas.height > 0) ctx.drawImage(img, 0, 0);
                       },100);
                   };
                   img.src = formData[key];
               }
           } else {
               const input = document.getElementById(key) || document.querySelector(`[name="${key}"]`);
               if(input) {
                   if (input.type === 'radio') {
                       const radioToSelect = document.querySelector(`[name="${key}"][value="${formData[key]}"]`);
                       if (radioToSelect) {
                           radioToSelect.checked = true;
                           radioToSelect.dispatchEvent(new Event('change'));
                       }
                   } else if (input.type === 'checkbox') {
                       if (Array.isArray(formData[key])) {
                           formData[key].forEach(value => {
                               const chk = document.querySelector(`[name="${key}"][value="${value}"]`);
                               if(chk) chk.checked = true;
                           });
                       }
                   } else {
                       input.value = formData[key];
                   }
               }
           }
       }
       // console.log("Form state loaded.");
   }
   
   const formSteps = [...document.querySelectorAll(".form-step")];
   const stepperItems = [...document.querySelectorAll(".stepper-item")];
   const prevBtn = document.getElementById("prevBtn");
   const nextBtn = document.getElementById("nextBtn");
   const submitBtn = document.getElementById("submitBtn"); 
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
           step.style.display = (index === stepIndex) ? 'block' : 'none'; 
           step.classList.toggle('active', index === stepIndex);
       });
       prevBtn.classList.toggle('d-none', stepIndex === 0);
       nextBtn.classList.toggle('d-none', stepIndex === formSteps.length - 1);
       submitBtn.classList.toggle('d-none', stepIndex !== formSteps.length - 1);
       
       updateStepper(); 
       
       window.scrollTo(0,0);

       if (stepIndex === 2) { 
           if (localDataSignaturePad && typeof localDataSignaturePad.resize === 'function') {
               setTimeout(() => localDataSignaturePad.resize(), 50); 
           }
           if (assinaturaSignaturePad && typeof assinaturaSignaturePad.resize === 'function') {
               setTimeout(() => assinaturaSignaturePad.resize(), 50);
           }
       }
   }
   
   function resetFormularioCompleto() {
       const form = document.getElementById('signatureLashesForm');
       form.reset(); 

       if (localDataSignaturePad) localDataSignaturePad.clear();
       if (assinaturaSignaturePad) assinaturaSignaturePad.clear();

       localStorage.removeItem('signatureFormAutosave');

       form.classList.remove('was-validated');
       document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
       document.querySelectorAll('.is-valid').forEach(el => el.classList.remove('is-valid'));
       
       document.querySelectorAll('.invalid-canvas-feedback').forEach(el => el.style.display = 'none');
       document.querySelectorAll('.radio-group-feedback').forEach(el => {
           el.innerHTML = '';
           el.className = 'radio-group-feedback'; 
           el.style.display = 'none';
       });
       
       currentStep = 0; 
       showStep(currentStep); 
       console.log("Formulário resetado.");
   }

   // --- INITIALIZATIONS & EVENT LISTENERS ---
   applyMasks();
   setupRadioGroupFeedback();
   
   const localDataSignaturePad = initializeSignaturePad('localDataCanvas');
   const assinaturaSignaturePad = initializeSignaturePad('assinaturaCanvas');

   document.querySelectorAll('.btn-clear-signature').forEach(button => {
       button.addEventListener('click', function() {
           const canvasId = this.dataset.canvas;
           if (canvasId === 'localDataCanvas' && localDataSignaturePad) {
               localDataSignaturePad.clear();
           } else if (canvasId === 'assinaturaCanvas' && assinaturaSignaturePad) {
               assinaturaSignaturePad.clear();
           }
           saveFormState(); 
       });
   });
   
   function validateCurrentStepFields(stepIndex) {
       const currentStepEl = formSteps[stepIndex];
       let isStepValid = true;
       currentStepEl.querySelectorAll('input[required], select[required], textarea[required]').forEach(input => {
           if (!input.checkValidity()) {
               isStepValid = false;
           }
       });
       const radioGroupsInStep = {};
       currentStepEl.querySelectorAll('input[type="radio"][required]').forEach(radio => { radioGroupsInStep[radio.name] = true; });
       for(const groupName in radioGroupsInStep) {
           if (!currentStepEl.querySelector(`input[name="${groupName}"]:checked`)) { 
               isStepValid = false;
               const feedbackEl = currentStepEl.querySelector(`.radio-group-feedback[data-feedback-for="${groupName}"]`);
               if (feedbackEl && !feedbackEl.classList.contains('text-success')) { 
                   feedbackEl.innerHTML = '<i class="bi bi-exclamation-circle-fill"></i> Por favor, selecione uma opção.';
                   feedbackEl.className = 'radio-group-feedback text-danger d-block';
               }
           }
       }
       if (currentStepEl.contains(document.getElementById('localDataCanvas'))) {
           const localCanvas = document.getElementById('localDataCanvas');
           const localFeedback = document.querySelector('.invalid-canvas-feedback[data-feedback-for="localDataCanvas"]');
           if (localDataSignaturePad && localDataSignaturePad.isEmpty()) {
               isStepValid = false;
               if(localCanvas) localCanvas.classList.add('is-invalid');
               if(localFeedback) localFeedback.style.display = 'block';
           } else {
                if(localCanvas) localCanvas.classList.remove('is-invalid');
                if(localFeedback) localFeedback.style.display = 'none';
           }
       }
        if (currentStepEl.contains(document.getElementById('assinaturaCanvas'))) {
           const sigCanvas = document.getElementById('assinaturaCanvas');
           const sigFeedback = document.querySelector('.invalid-canvas-feedback[data-feedback-for="assinaturaCanvas"]');
           if (assinaturaSignaturePad && assinaturaSignaturePad.isEmpty()) {
               isStepValid = false;
               if(sigCanvas) sigCanvas.classList.add('is-invalid');
               if(sigFeedback) sigFeedback.style.display = 'block';
           } else {
               if(sigCanvas) sigCanvas.classList.remove('is-invalid');
               if(sigFeedback) sigFeedback.style.display = 'none';
           }
       }
       return isStepValid;
   }

   nextBtn.addEventListener("click", () => {
       formSteps[currentStep].classList.add('was-validated'); 
       if (validateCurrentStepFields(currentStep)) {
           formSteps[currentStep].classList.remove('was-validated'); 
           currentStep++;
           showStep(currentStep);
           saveFormState(); 
       } else {
           // console.log("Validation failed for step " + (currentStep + 1));
           const currentStepFormElements = formSteps[currentStep].querySelectorAll('input, select, textarea');
           currentStepFormElements.forEach(el => {
               if(!el.checkValidity()){
                   // Bootstrap handles visual feedback
               }
           });
       }
   });

   prevBtn.addEventListener("click", () => {
       formSteps[currentStep].classList.remove('was-validated');
       currentStep--;
       showStep(currentStep);
   });
   
   showStep(currentStep); 

   document.getElementById('signatureLashesForm').addEventListener('change', saveFormState);
   document.getElementById('signatureLashesForm').addEventListener('keyup', saveFormState);
   ['localDataCanvas', 'assinaturaCanvas'].forEach(id => {
       const canvas = document.getElementById(id);
       if(canvas) {
           canvas.addEventListener('mouseup', saveFormState);
           canvas.addEventListener('touchend', saveFormState);
       }
   });
   
   loadFormState(); 

   const form = document.getElementById('signatureLashesForm');
   const confirmationModalElement = document.getElementById('confirmationModal');
   const confirmationModal = confirmationModalElement ? new bootstrap.Modal(confirmationModalElement) : null;
   const modalBodyContent = document.getElementById('modalBodyContent');

   form.addEventListener('submit', async function (event) {
       event.preventDefault();
       event.stopPropagation();
       
       let allStepsValid = true;
       for(let i=0; i < formSteps.length; i++) {
            formSteps[i].classList.add('was-validated'); 
           if (!validateCurrentStepFields(i)) {
               allStepsValid = false; 
           }
       }
       if (!form.checkValidity()) { 
           allStepsValid = false;
       }

       if (!allStepsValid) { 
           let errorMessage = "Por favor, corrija os erros no formulário antes de salvar. Verifique todas as etapas.";
           modalBodyContent.textContent = errorMessage;
           modalBodyContent.classList.remove('text-success');
           modalBodyContent.classList.add('text-danger');
           if (confirmationModal) confirmationModal.show();
       } else {
           console.log('Formulário válido. Gerando PDF...');
           await generatePDF();
           
           modalBodyContent.textContent = 'PDF gerado e download iniciado com sucesso!';
           modalBodyContent.classList.add('text-success');
           modalBodyContent.classList.remove('text-danger');
           if (confirmationModal) {
               confirmationModalElement.addEventListener('hidden.bs.modal', function onModalHidden() {
                   resetFormularioCompleto();
                   const primeiroCampo = document.getElementById('nome'); 
                   if (primeiroCampo) {
                       primeiroCampo.focus();
                   }
                   confirmationModalElement.removeEventListener('hidden.bs.modal', onModalHidden); 
               }, { once: true }); 
               confirmationModal.show();
           } else {
                resetFormularioCompleto(); 
                const primeiroCampo = document.getElementById('nome'); 
                if (primeiroCampo) {
                   primeiroCampo.focus();
                }
           }
       }
   });
});
