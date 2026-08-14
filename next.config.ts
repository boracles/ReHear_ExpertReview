import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";
const productionOrigin = "https://boracles.art";
const assetPrefix =
  isGitHubPagesBuild && repositoryName
    ? `${productionOrigin}/${repositoryName}`
    : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  assetPrefix,
};

export default nextConfig;
