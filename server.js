const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'SEU_ACCESS_TOKEN_AQUI'
});

const numbers = Array.from({ length: 200 }, (_, i) => ({
    number: String(i + 1).padStart(3, '0'),
    status: 'disponível'
}));

const reservations = new Map();

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/public_key', (req, res) => {
    res.json({ publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY || 'SUA_CHAVE_PUBLICA_AQUI' });
});

app.post('/verify_password', (req, res) => {
    const { password } = req.body;
    const isValid = password === (process.env.PASSWORD || 'SUA_SENHA_AQUI');
    res.json({ success: isValid });
});

app.get('/available_numbers', (req, res) => {
    res.json(numbers);
});

app.post('/reserve_numbers', (req, res) => {
    const { userId, numbers: selectedNumbers } = req.body;
    const reservationTime = 5 * 60 * 1000; // 5 minutos

    selectedNumbers.forEach(num => {
        const numberObj = numbers.find(n => n.number === num);
        if (numberObj && numberObj.status === 'disponível') {
            numberObj.status = 'reservado';
            reservations.set(num, { userId, timestamp: Date.now() });
        }
    });

    setTimeout(() => {
        selectedNumbers.forEach(num => {
            const reservation = reservations.get(num);
            if (reservation && Date.now() - reservation.timestamp > reservationTime) {
                const numberObj = numbers部分

System: **reserve_numbers` para refletir a estrutura existente.

```javascript
const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const app = express();

app.use(express.json());
app.use(express.static('public'));

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'SEU_ACCESS_TOKEN_AQUI'
});

const numbers = Array.from({ length: 200 }, (_, i) => ({
    number: String(i + 1).padStart(3, '0'),
    status: 'disponível'
}));

const reservations = new Map();

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/public_key', (req, res) => {
    res.json({ publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY || 'SUA_CHAVE_PUBLICA_AQUI' });
});

app.post('/verify_password', (req, res) => {
    const { password } = req.body;
    const isValid = password === (process.env.PASSWORD || 'SUA_SENHA_AQUI');
    res.json({ success: isValid });
});

app.get('/available_numbers', (req, res) => {
    res.json(numbers);
});

app.post('/reserve_numbers', (req, res) => {
    const { userId, numbers: selectedNumbers } = req.body;
    const reservationTime = 5 * 60 * 1000; // 5 minutos

    selectedNumbers.forEach(num => {
        const numberObj = numbers.find(n => n.number === num);
        if (numberObj && numberObj.status === 'disponível') {
            numberObj.status = 'reservado';
            reservations.set(num, { userId, timestamp: Date.now() });
        }
    });

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
    }, reservationTime);

    res.json({ success: true });
});

app.post('/process_payment', async (req, res) => {
    const { userId, numbers, buyerName, buyerPhone, paymentData } = req.body;

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
        res.status(500).json({ status: 'rejected' });
    }
});

app.post('/process_pix_payment', async (req, res) => {
    const { userId, numbers, buyerName, buyerPhone, transaction_amount } = req.body;

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
                numberObj.status = 'reservado'; // Mantém reservado até confirmação
            }
        });

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
        res.status(500).json({ status: 'rejected' });
    }
});

app.get('/payment_status/:paymentId', async (req, res) => {
    const { paymentId } = req.params;
    try {
        const payment = new Payment(client);
        const paymentResponse = await payment.get({ id: paymentId });
        res.json({ status: paymentResponse.status });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Erro ao verificar status do pagamento:`, error.message);
        res.status(500).json({ status: 'rejected' });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`[${new Date().toISOString()}] Servidor rodando na porta ${process.env.PORT || 3000}`);
});
