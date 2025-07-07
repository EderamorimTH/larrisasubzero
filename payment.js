const mp = new MercadoPago(process.env.MERCADO_PAGO_PUBLIC_KEY || 'SUA_CHAVE_PUBLICA_AQUI', { locale: 'pt-BR' });
let selectedNumbers = [];
let userId = Math.random().toString(36).substring(2, 15);

async function loadNumbers() {
    document.getElementById('loading-message').style.display = 'block';
    try {
        const response = await fetch('/available_numbers');
        if (!response.ok) throw new Error('Erro ao carregar números');
        const numbers = await response.json();
        const grid = document.getElementById('number-grid');
        grid.innerHTML = '';
        numbers.forEach(num => {
            const div = document.createElement('div');
            div.className = `number ${num.status === 'disponível' ? 'available' : num.status === 'reservado' ? 'reserved' : 'sold'}`;
            div.textContent = num.number;
            if (num.status === 'disponível') {
                div.addEventListener('click', () => toggleNumber(num.number, div));
            }
            grid.appendChild(div);
        });
        document.getElementById('loading-message').style.display = 'none';
    } catch (error) {
        console.error('Erro ao carregar números:', error);
        document.getElementById('number-error').style.display = 'block';
        document.getElementById('loading-message').style.display = 'none';
    }
}

function toggleNumber(number, element) {
    if (selectedNumbers.includes(number)) {
        selectedNumbers = selectedNumbers.filter(n => n !== number);
        element.classList.remove('reserved');
        element.classList.add('available');
    } else {
        selectedNumbers.push(number);
        element.classList.remove('available');
        element.classList.add('reserved');
    }
    updatePaymentSection();
}

function updatePaymentSection() {
    const paymentSection = document.getElementById('payment-section');
    paymentSection.style.display = selectedNumbers.length > 0 ? 'block' : 'none';
    document.getElementById('selected-numbers').textContent = `Números selecionados: ${selectedNumbers.join(', ') || 'Nenhum'}`;
    document.getElementById('total-amount').textContent = `Total: R$ ${(selectedNumbers.length * 5).toFixed(2)}`;
    if (selectedNumbers.length > 0) {
        renderCardForm();
    } else {
        document.getElementById('card-form').style.display = 'none';
        document.getElementById('pix-details').style.display = 'none';
    }
}

async function verifyPassword() {
    const password = document.getElementById('password-input').value;
    try {
        const response = await fetch('/verify_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const result = await response.json();
        if (result.success) {
            document.getElementById('password-overlay').style.display = 'none';
            loadNumbers();
        } else {
            alert('Senha incorreta!');
        }
    } catch (error) {
        console.error('Erro ao verificar senha:', error);
        alert('Erro ao verificar senha. Tente novamente.');
    }
}

async function reserveNumbers() {
    if (selectedNumbers.length === 0) return;
    try {
        const response = await fetch('/reserve_numbers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, numbers: selectedNumbers })
        });
        if (!response.ok) throw new Error('Erro ao reservar números');
    } catch (error) {
        console.error('Erro ao reservar números:', error);
        alert('Erro ao reservar números. Tente novamente.');
    }
}

async function renderCardForm() {
    document.getElementById('card-form').innerHTML = ''; // Limpa o formulário anterior
    const cardForm = mp.cardForm({
        amount: (selectedNumbers.length * 5).toString(),
        autoMount: true,
        form: {
            id: 'card-form',
            cardholderName: { id: 'card-holder', placeholder: 'Nome no cartão' },
            cardNumber: { id: 'card-number', placeholder: 'Número do cartão' },
            expirationDate: { id: 'card-expiry', placeholder: 'MM/AA' },
            securityCode: { id: 'card-cvc', placeholder: 'CVC' },
            installments: { id: 'installments', placeholder: 'Parcelas' }
        },
        callbacks: {
            onFormMounted: error => {
                if (error) console.warn('Erro ao montar formulário:', error);
            },
            onSubmit: async event => {
                event.preventDefault();
                try {
                    const { paymentMethodId, issuerId, token } = await mp.cardForm.createCardToken();
                    await processCardPayment(token, paymentMethodId, issuerId);
                } catch (error) {
                    console.error('Erro ao processar cartão:', error);
                    alert('Erro ao processar pagamento com cartão!');
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
        const response = await fetch('/process_payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, numbers: selectedNumbers, buyerName, buyerPhone, paymentData })
        });
        if (!response.ok) throw new Error('Erro ao processar pagamento');
        const result = await response.json();
        if (result.status === 'approved') {
            alert('Pagamento aprovado!');
            selectedNumbers = [];
            updatePaymentSection();
            loadNumbers();
        } else {
            alert('Pagamento recusado!');
            loadNumbers();
        }
    } catch (error) {
        console.error('Erro ao processar pagamento:', error);
        alert('Erro ao processar pagamento!');
        loadNumbers();
    }
}

document.getElementById('password-submit').addEventListener('click', verifyPassword);
document.getElementById('password-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyPassword();
});

document.getElementById('pay-card').addEventListener('click', () => {
    document.getElementById('card-form').style.display = 'block';
    document.getElementById('pix-details').style.display = 'none';
    renderCardForm();
});

document.getElementById('pay-pix').addEventListener('click', async () => {
    document.getElementById('card-form').style.display = 'none';
    document.getElementById('pix-details').style.display = 'block';
    await reserveNumbers();
    const transaction_amount = selectedNumbers.length * 5;
    const buyerName = document.getElementById('buyer-name').value;
    const buyerPhone = document.getElementById('buyer-phone').value;
    try {
        const response = await fetch('/process_pix_payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, numbers: selectedNumbers, buyerName, buyerPhone, transaction_amount })
        });
        if (!response.ok) throw new Error('Erro ao gerar Pix');
        const result = await response.json();
        if (result.qr_code) {
            document.getElementById('pix-qr').src = `data:image/png;base64,${result.qr_code_base64}`;
            document.getElementById('pix-code').textContent = result.qr_code;
            checkPixPaymentStatus(result.payment_id);
        } else {
            alert('Erro ao gerar Pix!');
            loadNumbers();
        }
    } catch (error) {
        console.error('Erro ao processar Pix:', error);
        alert('Erro ao gerar Pix!');
        loadNumbers();
    }
});

async function checkPixPaymentStatus(paymentId) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`/payment_status/${paymentId}`);
            if (!response.ok) throw new Error('Erro ao verificar status do pagamento');
            const result = await response.json();
            if (result.status === 'approved') {
                clearInterval(interval);
                alert('Pagamento Pix aprovado!');
                selectedNumbers = [];
                updatePaymentSection();
                loadNumbers();
            } else if (result.status === 'rejected') {
                clearInterval(interval);
                alert('Pagamento Pix recusado!');
                loadNumbers();
            }
        } catch (error) {
            console.error('Erro ao verificar status do Pix:', error);
            clearInterval(interval);
            alert('Erro ao verificar status do pagamento!');
            loadNumbers();
        }
    }, 5000);
}
