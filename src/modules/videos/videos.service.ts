import { jobsRepository } from "../jobs/jobs.repository.js";
import { mediaRepository } from "../media/media.repository.js";
import { productsRepository } from "../products/products.repository.js";
import { AppError } from "../../shared/errors/AppError.js";

export const videosService = {
  generate(payload: { product_id: string; media_asset_ids: string[]; style: string; duration: string; briefing?: string; platform?: string }) {
    const product = productsRepository.findById(payload.product_id);
    if (!product) throw new AppError("Produto não encontrado para geração de vídeo", 404, "PRODUCT_NOT_FOUND");

    const job = jobsRepository.create({
      type: "video_generation",
      status: "queued",
      title: `Gerar vídeo ${payload.style} - ${product.name}`,
      product_id: product.id,
      progress: 0,
    });

    const asset = mediaRepository.create({
      product_id: product.id,
      product_name: product.name,
      type: "generated_video",
      title: `Vídeo ${payload.style} - ${product.name}`,
      status: "generating",
      source: "backend_job",
      url: product.image_url || product.uploaded_image_url || "",
      thumbnail_url: product.image_url || product.uploaded_image_url || "",
      caption: payload.briefing,
      platforms: payload.platform ? [payload.platform] : [],
      quality_score: 0,
    });

    return { job, asset };
  },
};
