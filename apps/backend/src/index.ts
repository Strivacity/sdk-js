import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { router } from './api';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api', router);

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
