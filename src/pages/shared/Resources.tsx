import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getResourcesForUser,
  getCategories,
  recordResourceView,
} from '../../api/resources';
import { useAuth } from '../../contexts/AuthContext';
import type { Resource, ResourceType } from '../../types';

interface ResourcesProps {
  audience: 'managers' | 'partners';
}

export default function Resources({ audience }: ResourcesProps) {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | ResourceType>('all');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['resources', audience],
    queryFn: () => getResourcesForUser(audience),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['resource-categories', audience],
    queryFn: () => getCategories(audience),
  });

  const filteredResources = resources.filter(r => {
    if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
    if (selectedType !== 'all' && r.resource_type !== selectedType) return false;
    return true;
  });

  const featuredResources = resources.filter(r => r.is_featured);

  const handleViewResource = async (resource: Resource) => {
    setSelectedResource(resource);
    if (user?.id) {
      try {
        await recordResourceView(resource.id, user.id);
      } catch (error) {
        // Silent fail for view tracking
      }
    }
  };

  const getTypeIcon = (type: ResourceType) => {
    switch (type) {
      case 'video': return '🎬';
      case 'image': return '🖼️';
      case 'text': return '📄';
    }
  };

  const renderContent = (resource: Resource) => {
    switch (resource.resource_type) {
      case 'text':
        return (
          <div className="resource-text-content">
            {resource.content_text?.split('\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        );
      case 'video':
        if (resource.external_url) {
          // Handle YouTube/Vimeo embeds
          const videoId = extractVideoId(resource.external_url);
          if (videoId.type === 'youtube') {
            return (
              <div className="video-container">
                <iframe
                  src={`https://www.youtube.com/embed/${videoId.id}`}
                  title={resource.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            );
          }
        }
        if (resource.file_url) {
          return (
            <div className="video-container">
              <video controls src={resource.file_url}>
                Your browser does not support video playback.
              </video>
            </div>
          );
        }
        return <p>Video not available</p>;
      case 'image':
        return (
          <div className="image-container">
            <img src={resource.file_url} alt={resource.title} />
          </div>
        );
    }
  };

  return (
    <div className="resources-page">
      <header className="page-header">
        <h1>Resource Center</h1>
        <p>Learn how to work with Route.ng and navigate our platform</p>
      </header>

      {/* Featured Resources */}
      {featuredResources.length > 0 && (
        <section className="featured-section">
          <h2>Featured</h2>
          <div className="featured-grid">
            {featuredResources.slice(0, 3).map(resource => (
              <div
                key={resource.id}
                className="featured-card"
                onClick={() => handleViewResource(resource)}
              >
                <span className="type-icon">{getTypeIcon(resource.resource_type)}</span>
                <h3>{resource.title}</h3>
                {resource.description && <p>{resource.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-group">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <button
            className={selectedType === 'all' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setSelectedType('all')}
          >
            All
          </button>
          <button
            className={selectedType === 'video' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setSelectedType('video')}
          >
            Videos
          </button>
          <button
            className={selectedType === 'image' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setSelectedType('image')}
          >
            Images
          </button>
          <button
            className={selectedType === 'text' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setSelectedType('text')}
          >
            Articles
          </button>
        </div>
      </div>

      {/* Resources Grid */}
      {isLoading ? (
        <div className="loading">Loading resources...</div>
      ) : filteredResources.length === 0 ? (
        <div className="empty-state">
          <p>No resources found.</p>
        </div>
      ) : (
        <div className="resources-list">
          {filteredResources.map(resource => (
            <div
              key={resource.id}
              className="resource-item"
              onClick={() => handleViewResource(resource)}
            >
              <span className="type-icon">{getTypeIcon(resource.resource_type)}</span>
              <div className="resource-info">
                <h3>{resource.title}</h3>
                {resource.description && <p>{resource.description}</p>}
                <div className="resource-meta">
                  {resource.category && <span className="category">{resource.category}</span>}
                  <span className="views">{resource.view_count} views</span>
                </div>
              </div>
              <span className="arrow">→</span>
            </div>
          ))}
        </div>
      )}

      {/* Resource View Modal */}
      {selectedResource && (
        <div className="modal-overlay" onClick={() => setSelectedResource(null)}>
          <div className="modal resource-view-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedResource(null)}>
              &times;
            </button>
            <div className="resource-view-header">
              <span className="type-icon large">{getTypeIcon(selectedResource.resource_type)}</span>
              <div>
                <h2>{selectedResource.title}</h2>
                {selectedResource.category && (
                  <span className="category-tag">{selectedResource.category}</span>
                )}
              </div>
            </div>
            {selectedResource.description && (
              <p className="resource-description">{selectedResource.description}</p>
            )}
            <div className="resource-content">
              {renderContent(selectedResource)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to extract video IDs from URLs
function extractVideoId(url: string): { type: 'youtube' | 'vimeo' | 'unknown'; id: string } {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', id: ytMatch[1] };

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', id: vimeoMatch[1] };

  return { type: 'unknown', id: '' };
}
