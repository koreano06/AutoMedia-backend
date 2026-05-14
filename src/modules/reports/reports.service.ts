import { postsRepository } from "../posts/posts.repository.js";
import { productsRepository } from "../products/products.repository.js";

function engagement(post: { engagement_likes?: number; engagement_comments?: number; engagement_shares?: number }) {
  return (post.engagement_likes || 0) + (post.engagement_comments || 0) + (post.engagement_shares || 0);
}

export const reportsService = {
  overview() {
    const posts = postsRepository.list("-created_at", 1000);
    const products = productsRepository.list("-created_at", 1000);
    const published = posts.filter((post) => post.status === "published");
    const reach = posts.reduce((sum, post) => sum + (post.engagement_reach || 0), 0);
    const interactions = posts.reduce((sum, post) => sum + engagement(post), 0);

    return {
      products_count: products.length,
      posts_count: posts.length,
      published_count: published.length,
      scheduled_count: posts.filter((post) => post.status === "scheduled").length,
      reach,
      interactions,
      average_engagement: posts.length ? Math.round(interactions / posts.length) : 0,
    };
  },

  platforms() {
    const posts = postsRepository.list("-created_at", 1000);
    const platforms = [...new Set(posts.map((post) => post.platform).filter(Boolean))];
    return platforms.map((platform) => {
      const platformPosts = posts.filter((post) => post.platform === platform);
      return {
        platform,
        posts: platformPosts.length,
        reach: platformPosts.reduce((sum, post) => sum + (post.engagement_reach || 0), 0),
        engagement: platformPosts.reduce((sum, post) => sum + engagement(post), 0),
      };
    });
  },
};
