import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import aiProvidersRouter from "./routes/aiProviders";
import aiAnalysisRouter from "./routes/aiAnalysis";
import predictionRouter from "./routes/prediction";
import { logger } from "./lib/logger";
import { initDefaultProviders } from "./lib/aiProviders";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api/ai-providers", aiProvidersRouter);
app.use("/api/ai", aiAnalysisRouter);
app.use("/api/prediction", predictionRouter);

initDefaultProviders();

export default app;
