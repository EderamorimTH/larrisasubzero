require('dotenv').config();
const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const app = express();

app.use(express.json());
app.use(express.static('.')); // Serve arquivos da raiz

// Adicionar cabeçalhos CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'SEU_ACCESS_TOKEN_AQUI'
});

const numbers = Array.from({ length: 200 }, (_, i) => ({
    number: String(i + 1).padStart(3, '0'),
    status: 'disponível'
}));

const reservations = new Map();

console.log('Servidor iniciado. Estado inicial dos números:', numbers.slice(0, 5));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/public_key', (req, res) => {
    res.json({ publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY || 'SUA_CHAVE_PUBLICA_AQUI' });
});

app.post('/verify_password', (req, res) => {
    const { password } = req.body;
    const isValid = password === (process.env.PASSWORD || 'SorteioSubZero2025');
    console.log('Verificação de senha:', { password, isValid });
    res.json({ success: isValid });
});

app.get('/available_numbers', (req, res) => {
    console.log('Rota /available_numbers chamada. Total de números:', numbers.length);
    res.json(numbers);
});

app.post('/reset_numbers', (req, res) => {
    numbers.forEach(num => (num.status = 'disponível'));
    reservations.clear();
    console.log('Números resetados. Estado atual:', numbers.slice(0, 5));
    res.json({ success: true });
});

app.post('/reserve_numbers', (req, res) => {
    const { userId, numbers: selectedNumbers } = req.body;
    if (!userId || !selectedNumbers || !Array.isArray(selectedNumbers)) {
        console.log('Erro ao reservar números: Dados inválidos', { userId, selectedNumbers });
        return res.status(400).json({ error: 'Dados inválidos' });
    }
    const reservationTime = 5 * 60 * 1000; // 5 minutos

    const reserved = selectedNumbers.every(num => {
        const numberObj = numbers.find(n => n.number === num);
        if (numberObj && numberObj.status === 'disponível') {
            numberObj.status = 'reservado';
            reservations.set(num, { userId, timestamp: Date.now() });
            return true;
        }
        return false;
    });

    if (!reserved) {
        console.log('Erro ao reservar números: Alguns números não estão disponíveis', { selectedNumbers });
        return res.status(400).json({ error: 'Alguns números não estão disponíveis' });
    }

    setTimeout(() => {
        selectedNumbers.forEach(num => {
            const reservation = reservations.get(num);
            if (reservation && Date.now() - reservation.timestamp > reservationTime) {
                const numberObj = numbers.find(n => n.number === num);
                if (numberObj && numberObj.status === 'reservado') {
                    numberObj.status = 'disponível';
                    reservations.delete(num);
                }
            }
        });
        console.log('Números liberados após timeout:', selectedNumbers);
    }, reservationTime);

    res.json({ success: true });
});

app.post('/process_payment', async (req, res) => {
    const { userId, numbers, buyerName, buyerPhone, paymentData } = req.body;
    if (!userId || !numbers || !buyerName || !buyerPhone || !paymentData) {
        console.log('Erro ao processar pagamento: Dados incompletos', { userId, numbers, buyerName, buyerPhone });
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        const payment = new Payment(client);
        const paymentResponse = await payment.create({
            body: {
                transaction_amount: paymentData.transaction_amount,
                token: paymentData.token,
                description: `Compra de números: ${numbers.join(', ')}`,
                payment_method_id: paymentData.payment_method_id,
                issuer_id: paymentData.issuer_id,
                installments: paymentData.installments || 1,
                payer: {
                    email: `${userId}@subzerobeer.com`,
                    name: buyerName,
                    identification: { type: 'CPF', number: buyerPhone }
                }
            }
        });

        numbers.forEach(num => {
            const numberObj = numbers.find(n => n.number === num);
            if (numberObj && numberObj.status === 'reservado') {
                numberObj.status = paymentResponse.status === 'approved' ? 'vendido' : 'disponível';
                reservations.delete(num);
            }
        });

        console.log('Pagamento processado:', { status: paymentResponse.status, numbers });
        res.json({ status: paymentResponse.status });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Erro ao processar pagamento:`, error.message);
        numbers.forEach(num => {
            const numberObj = numbers.find(n => n.number === num);
            if (numberObj && numberObj.status === 'reservado') {
                numberObj.status = 'disponível';
                reservations.delete(num);
            }
        });
        res.status(500).json({ status: 'rejected', error: error.message });
    }
});

app.post('/process_pix_payment', async (req, res) => {
    const { userId, numbers, buyerName, buyerPhone, transaction_amount } = req.body;
    if (!userId || !numbers || !buyerName || !buyerPhone || !transaction_amount) {
        console.log('Erro ao processar Pix: Dados incompletos', { userId, numbers, buyerName, buyerPhone });
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        const payment = new Payment(client);
        const paymentResponse = await payment.create({
            body: {
                transaction_amount,
                description: `Compra de números: ${numbers.join(', ')}`,
                payment_method_id: 'pix',
                payer: {
                    email: `${userId}@subzerobeer.com`,
                    first_name: buyerName.split(' ')[0],
                    last_name: buyerName.split(' ').slice(1).join(' '),
                    identification: { type: 'CPF', number: buyerPhone }
                }
            }
        });

        numbers.forEach(num => {
            const numberObj = numbers.find(n => n.number === num);
            if (numberObj && numberObj.status === 'reservado') {
                numberObj.status = 'reservado';
            }
        });

        console.log('Pix gerado:', { payment_id: paymentResponse.id });
        res.json({
            payment_id: paymentResponse.id,
            qr_code: paymentResponse.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: paymentResponse.point_of_interaction.transaction_data.qr_code_base64
        });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Erro ao processar pagamento Pix:`, error.message);
        numbers.forEach(num => {
            const numberObj = numbers.find(n => n.number === num);
            if (numberObj && numberObj.status === 'reservado') {
                numberObj.status = 'disponível';
                reservations.delete(num);
            }
        });
        res.status(500).json({ status: 'rejected', error: error.message });
    }
});

app.get('/payment_status/:paymentId', async (req, res) => {
    const { paymentId } = req.params;
    try {
        const payment = new Payment(client);
        const paymentResponse = await payment.get({ id: paymentId });
        console.log('Status do pagamento verificado:', { paymentId, status: paymentResponse.status });
        res.json({ status: paymentResponse.status });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Erro ao verificar status do pagamento:`, error.message);
        res.status(500).json({ status: 'rejected', error: error.message });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`[${new Date().toISOString()}] Servidor rodando na porta ${process.env.PORT || 3000}`);
});
