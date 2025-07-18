const mp = new MercadoPago('TEST-5e5bdff5-dc61-49c3-a5f7-c14eb59b3ea2', { locale: 'pt-BR' });
let selectedNumbers = [];
let userId = Math.random().toString(36).substring(2, 15);

async function loadNumbers() {
    console.log('Iniciando loadNumbers...');
    const loadingMessage = document.getElementById('loading-message');
    const numbersGrid = document.getElementById('numbers-grid');
    if (!loadingMessage || !numbersGrid) {
        console.error('Elementos DOM não encontrados:', { loadingMessage, numbersGrid });
        return;
    }
    loadingMessage.style.display = 'block';
    numbersGrid.style.display = 'none';
    try {
        console.log('Fazendo fetch para https://larrisasubzero.onrender.com/available_numbers');
        const response = await fetch('https://larrisasubzero.onrender.com/available_numbers', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('Resposta recebida:', { status: response.status, ok: response.ok });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro ao carregar números: ${response.status} ${response.statusText} - ${errorText}`);
        }
        const numbers = await response.json();
        console.log('Números recebidos:', numbers.slice(0, 5));
        numbersGrid.innerHTML = '';
        numbers.forEach(num => {
            const div = document.createElement('div');
            div.className = `number ${num.status === 'disponível' ? 'available' : num.status === 'reservado' ? 'reserved' : 'sold'}`;
            div.textContent = num.number;
            if (num.status === 'disponível') {
                div.addEventListener('click', () => toggleNumber(num.number, div));
            }
            numbersGrid.appendChild(div);
        });
        loadingMessage.style.display = 'none';
        numbersGrid.style.display = 'grid';
    } catch (error) {
        console.error('Erro ao carregar números:', error);
        const numberError = document.getElementById('number-error');
        const errorDetails = document.getElementById('error-details');
        if (numberError && errorDetails) {
            numberError.style.display = 'block';
            errorDetails.textContent = `Erro ao carregar números: ${error.message}. Tente novamente ou entre em contato via Instagram.`;
        }
        loadingMessage.style.display = 'none';
    }
}

function toggleNumber(number, element) {
    if (selectedNumbers.includes(number)) {
        selectedNumbers = selectedNumbers.filter(n => n !== number);
        element.classList.remove('selected');
        element.classList.add('available');
    } else {
        selectedNumbers.push(number);
        element.classList.remove('available');
        element.classList.add('selected');
    }
    updatePaymentSection();
}

function updatePaymentSection() {
    const paymentSection = document.getElementById('payment-form-section');
    paymentSection.style.display = selectedNumbers.length > 0 ? 'block' : 'none';
    document.getElementById('selected-numbers').textContent = selectedNumbers.join(', ') || 'Nenhum';
    document.getElementById('total-price').textContent = (selectedNumbers.length * 5).toFixed(2);
}

async function verifyPassword() {
    const passwordInput = document.getElementById('password-input').value;
    const passwordError = document.getElementById('password-error');
    const passwordOverlay = document.getElementById('password-overlay');
    try {
        console.log('Verificando senha...');
        const response = await fetch('https://larrisasubzero.onrender.com/verify_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: passwordInput })
        });
        const result = await response.json();
        console.log('Resultado da verificação de senha:', result);
        if (result.success) {
            passwordOverlay.style.display = 'none';
            window.location.href = '/sorteio.html';
        } else {
            passwordError.style.display = 'block';
            document.getElementById('password-input').value = '';
        }
    } catch (error) {
        console.error('Erro ao verificar senha:', error);
        passwordError.textContent = 'Erro ao verificar a senha. Tente novamente.';
        passwordError.style.display = 'block';
        document.getElementById('password-input').value = '';
    }
}

async function reserveNumbers() {
    if (selectedNumbers.length === 0) return;
    try {
        console.log('Reservando números:', selectedNumbers);
        const response = await fetch('https://larrisasubzero.onrender.com/reserve_numbers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, numbers: selectedNumbers })
        });
        if (!response.ok) throw new Error(`Erro ao reservar números: ${response.status} ${response.statusText}`);
        console.log('Números reservados com sucesso');
    } catch (error) {
        console.error('Erro ao reservar números:', error);
        document.getElementById('error-message').style.display = 'block';
    }
}

async function renderCardForm() {
    document.getElementById('card-payment-form').innerHTML = '';
    console.log('Renderizando formulário de cartão...');
    const cardForm = mp.cardForm({
        amount: (selectedNumbers.length * 5).toString(),
        autoMount: true,
        form: {
            id: 'card-payment-form',
            cardholderName: { id: 'cardholderName', placeholder: 'Nome no cartão' },
            cardNumber: { id: 'cardNumber', placeholder: 'Número do cartão' },
            expirationDate: { id: 'cardExpiration', placeholder: 'MM/AA' },
            securityCode: { id: 'securityCode', placeholder: 'CVV' },
            installments: { id: 'installments', placeholder: 'Parcelas' },
            identificationType: { id: 'docType', placeholder: 'Tipo de documento' },
            identificationNumber: { id: 'docNumber', placeholder: 'CPF do titular' }
        },
        callbacks: {
            onFormMounted: error => {
                if (error) console.warn('Erro ao montar formulário:', error);
            },
            onSubmit: async event => {
                event.preventDefault();
                try {
                    console.log('Processando pagamento com cartão...');
                    const { paymentMethodId, issuerId, token } = await mp.cardForm.createCardToken();
                    await processCardPayment(token, paymentMethodId, issuerId);
                } catch (error) {
                    console.error('Erro ao processar cartão:', error);
                    document.getElementById('error-message').style.display = 'block';
                    loadNumbers();
                }
            },
            onFetching: resource => {
                console.log('Buscando recurso:', resource);
            }
        }
    });
}

async function processCardPayment(token, paymentMethodId, issuerId) {
    await reserveNumbers();
    const transaction_amount = selectedNumbers.length * 5;
    const buyerName = document.getElementById('buyer-name').value;
    const buyerPhone = document.getElementById('buyer-phone').value;
    try {
        const paymentData = {
            transaction_amount,
            token,
            payment_method_id: paymentMethodId,
            issuer_id: issuerId,
            installments: parseInt(document.getElementById('installments').value) || 1
        };
        console.log('Enviando pagamento:', { userId, numbers: selectedNumbers, buyerName, buyerPhone });
        const response = await fetch('https://larrisasubzero.onrender.com/process_payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, numbers: selectedNumbers, buyerName, buyerPhone, paymentData })
        });
        if (!response.ok) throw new Error(`Erro ao processar pagamento: ${response.status} ${response.statusText}`);
        const result = await response.json();
        console.log('Resultado do pagamento:', result);
        if (result.status === 'approved') {
            document.getElementById('success-message').style.display = 'block';
            selectedNumbers = [];
            updatePaymentSection();
            loadNumbers();
        } else if (result.status === 'pending') {
            document.getElementById('pending-message').style.display = 'block';
        } else {
            document.getElementById('error-message').style.display = 'block';
            loadNumbers();
        }
    } catch (error) {
        console.error('Erro ao processar pagamento:', error);
        document.getElementById('error-message').style.display = 'block';
        loadNumbers();
    }
}

document.getElementById('password-submit').addEventListener('click', verifyPassword);
document.getElementById('password-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyPassword();
});

document.getElementById('header-logo').addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('password-overlay').style.display = 'flex';
    document.getElementById('password-input').focus();
});

document.getElementById('pay-card').addEventListener('click', () => {
    document.getElementById('card-payment-form').style.display = 'block';
    document.getElementById('pix-payment-form').style.display = 'none';
    renderCardForm();
});

document.getElementById('pay-pix').addEventListener('click', async () => {
    document.getElementById('card-payment-form').style.display = 'none';
    document.getElementById('pix-payment-form').style.display = 'block';
    await reserveNumbers();
    const transaction_amount = selectedNumbers.length * 5;
    const buyerName = document.getElementById('buyer-name').value;
    const buyerPhone = document.getElementById('buyer-phone').value;
    try {
        console.log('Processando pagamento Pix...');
        const response = await fetch('https://larrisasubzero.onrender.com/process_pix_payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, numbers: selectedNumbers, buyerName, buyerPhone, transaction_amount })
        });
        if (!response.ok) throw new Error(`Erro ao gerar Pix: ${response.status} ${response.statusText}`);
        const result = await response.json();
        console.log('Resultado Pix:', result);
        if (result.qr_code) {
            document.getElementById('pix-qr-code').src = `data:image/png;base64,${result.qr_code_base64}`;
            document.getElementById('pix-code').textContent = result.qr_code;
            checkPixPaymentStatus(result.payment_id);
        } else {
            document.getElementById('error-message').style.display = 'block';
            loadNumbers();
        }
    } catch (error) {
        console.error('Erro ao processar Pix:', error);
        document.getElementById('error-message').style.display = 'block';
        loadNumbers();
    }
});

async function checkPixPaymentStatus(paymentId) {
    const interval = setInterval(async () => {
        try {
            console.log('Verificando status do Pix:', paymentId);
            const response = await fetch(`https://larrisasubzero.onrender.com/payment_status/${paymentId}`);
            if (!response.ok) throw new Error(`Erro ao verificar status do pagamento: ${response.status} ${response.statusText}`);
            const result = await response.json();
            console.log('Status do Pix:', result);
            if (result.status === 'approved') {
                clearInterval(interval);
                document.getElementById('success-message').style.display = 'block';
                selectedNumbers = [];
                updatePaymentSection();
                loadNumbers();
            } else if (result.status === 'rejected') {
                clearInterval(interval);
                document.getElementById('error-message').style.display = 'block';
                loadNumbers();
            } else if (result.status === 'pending') {
                document.getElementById('pending-message').style.display = 'block';
            }
        } catch (error) {
            console.error('Erro ao verificar status do Pix:', error);
            clearInterval(interval);
            document.getElementById('error-message').style.display = 'block';
            loadNumbers();
        }
    }, 5000);
}

// Carrega os números automaticamente ao abrir a página
loadNumbers();
