CREATE TABLE "documents" (
	"document_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"original_name" varchar(255) NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" varchar(150) NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" varchar(30) DEFAULT 'UPLOADED' NOT NULL,
	"page_count" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "extracted_elements" (
	"element_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"original" integer NOT NULL,
	"element_type" varchar(40) NOT NULL,
	"content" jsonb NOT NULL,
	"content_text" text NOT NULL,
	"source" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extracted_elements" ADD CONSTRAINT "extracted_elements_document_id_documents_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extracted_elements_document_idx" ON "extracted_elements" USING btree ("document_id");