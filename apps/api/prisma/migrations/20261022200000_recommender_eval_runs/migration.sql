-- Recommender evaluation results (scripts/eval-recommender.ts --save) — replaces the hard-coded
-- metrics on the admin dashboard.

-- CreateTable
CREATE TABLE "recommender_eval_runs" (
    "run_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" VARCHAR(40) NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "k" INTEGER NOT NULL,
    "precision" DOUBLE PRECISION NOT NULL,
    "recall" DOUBLE PRECISION NOT NULL,
    "f1" DOUBLE PRECISION NOT NULL,
    "ndcg" DOUBLE PRECISION NOT NULL,
    "hit_rate" DOUBLE PRECISION NOT NULL,
    "user_coverage" DOUBLE PRECISION NOT NULL,
    "baseline_ndcg" DOUBLE PRECISION NOT NULL,
    "eval_users" INTEGER NOT NULL,
    "graph_in_sync" BOOLEAN NOT NULL,
    "low_data" BOOLEAN NOT NULL,

    CONSTRAINT "recommender_eval_runs_pkey" PRIMARY KEY ("run_id")
);

-- CreateIndex
CREATE INDEX "recommender_eval_runs_created_at_idx" ON "recommender_eval_runs"("created_at" DESC);
