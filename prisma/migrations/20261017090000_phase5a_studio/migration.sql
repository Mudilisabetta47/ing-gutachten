-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id","key")
);

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_key_chk" CHECK (char_length(key) BETWEEN 1 AND 60);
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_size_chk" CHECK (pg_column_size(value) <= 40000);

SELECT public.ing_harden_public();
