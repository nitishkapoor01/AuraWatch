import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEO = ({ title, description, image, url, type = 'website' }) => {
  const siteName = 'AuraWatch';
  const defaultTitle = 'AuraWatch - Free Movies & TV Shows in HD';
  const defaultDescription = 'Watch and download the latest movies and TV shows in 1080p. Free, fast, and no buffering!';
  const defaultImage = 'https://aurawatch.netlify.app/AuraMovie_logo.png.png'; // Make sure this is absolute URL
  
  const seo = {
    title: title ? `${title} | ${siteName}` : defaultTitle,
    description: description || defaultDescription,
    image: image || defaultImage,
    url: url || (typeof window !== 'undefined' ? window.location.href : ''),
  };

  return (
    <Helmet>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      
      {/* Open Graph / Facebook / Telegram / WhatsApp */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:image" content={seo.image} />
      <meta property="og:url" content={seo.url} />
      <meta property="og:site_name" content={siteName} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={seo.image} />
    </Helmet>
  );
};

export default SEO;
