export type EntityId = string;
export type ISODateString = string;

export type Platform =
  | "instagram"
  | "tiktok"
  | "facebook"
  | "youtube"
  | "shopee"
  | "mercadolivre"
  | "twitter"
  | string;

export type Status =
  | "queued"
  | "processing"
  | "analyzing"
  | "collecting"
  | "generating"
  | "review"
  | "approved"
  | "publishing"
  | "published"
  | "draft"
  | "scheduled"
  | "failed"
  | "collected"
  | "pending_review"
  | "rejected"
  | "needs_changes"
  | "paused"
  | string;

export type ProductInputSource = "manual" | "image_upload" | "product_url";
export type MediaAssetType = "image" | "video" | "generated_video";
export type JobType = "product_analysis" | "media_collection" | "video_generation" | "post_publishing" | "comment_reply";
export type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export type Product = {
  id: EntityId;
  name: string;
  input_source?: ProductInputSource;
  source_url?: string;
  image_url?: string;
  uploaded_image_url?: string;
  category?: string;
  description?: string;
  brand?: string;
  price?: number | string;
  cost_price?: number | string;
  margin_percent?: number;
  sku?: string;
  internal_code?: string;
  supplier_name?: string;
  supplier_contact?: string;
  supplier_lead_time_days?: number;
  stock_quantity?: number;
  min_stock?: number;
  marketplace_origin?: string;
  currency?: string;
  product_url?: string;
  affiliate_url?: string;
  keywords?: string[];
  attributes?: Record<string, string | number | boolean>;
  analysis_summary?: string;
  status?: Status;
  media_count?: number;
  posts_published?: number;
  videos_generated?: number;
  created_at?: ISODateString;
  updated_at?: ISODateString;
};

export type MediaAsset = {
  id: EntityId;
  product_id?: EntityId;
  product_name?: string;
  type?: MediaAssetType | string;
  title?: string;
  status?: Status;
  source?: string;
  source_url?: string;
  url?: string;
  thumbnail_url?: string;
  storage_key?: string;
  mime_type?: string;
  file_size?: number;
  caption?: string;
  platforms?: Platform[];
  media_asset_id?: EntityId;
  quality_score?: number;
  duration?: number | string;
  created_at?: ISODateString;
  updated_at?: ISODateString;
  review_notes?: string;
  reviewed_at?: ISODateString;
  reviewed_by?: string;
  previous_status?: Status;
  rejection_reason?: string;
};

export type Post = {
  id: EntityId;
  product_id?: EntityId;
  media_asset_id?: EntityId;
  product_name?: string;
  platform?: Platform;
  caption?: string;
  status?: Status;
  scheduled_at?: ISODateString;
  published_at?: ISODateString;
  external_post_id?: string;
  external_url?: string;
  error_message?: string;
  engagement_likes?: number;
  engagement_comments?: number;
  engagement_shares?: number;
  engagement_reach?: number;
  thumbnail_url?: string;
  campaign_name?: string;
  created_at?: ISODateString;
  updated_at?: ISODateString;
  retry_count?: number;
  last_sync_at?: ISODateString;
};

export type Comment = {
  id: EntityId;
  post_id?: EntityId;
  external_comment_id?: string;
  author?: string;
  content?: string;
  platform?: Platform;
  is_purchase_intent?: boolean;
  auto_replied?: boolean;
  reply_content?: string;
  detected_at?: ISODateString;
  replied_at?: ISODateString;
};

export type PlatformAccount = {
  id: EntityId;
  platform: Platform;
  account_name: string;
  account_id?: string;
  status: "connected" | "expired" | "error" | "disconnected";
  scopes?: string[];
  expires_at?: ISODateString;
  last_sync_at?: ISODateString;
  error_message?: string;
};

export type AutomationSettings = {
  id?: EntityId;
  auto_reply: boolean;
  auto_schedule: boolean;
  notifications: boolean;
  random_schedule: boolean;
  purchase_keywords: string[];
  posting_start: string;
  posting_end: string;
  enabled_platforms: Platform[];
};

export type Job = {
  id: EntityId;
  type: JobType;
  status: JobStatus;
  title: string;
  progress?: number;
  product_id?: EntityId;
  media_asset_id?: EntityId;
  post_id?: EntityId;
  result_url?: string;
  error_message?: string;
  created_at?: ISODateString;
  updated_at?: ISODateString;
  completed_at?: ISODateString;
};
