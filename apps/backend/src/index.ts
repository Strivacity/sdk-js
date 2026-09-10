import express from 'express';
import cors from 'cors';
import { handlers } from './handlers';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use('/auth', handlers);

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
