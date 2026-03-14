import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllResources,
  createResource,
  updateResource,
  deleteResource,
  uploadResourceFile,
} from '../../api/resources';
import { useAuth } from '../../contexts/AuthContext';
import type { Resource, ResourceType, ResourceAudience } from '../../types';

const RESOURCE_CATEGORIES = [
  'Getting Started',
  'Transactions',
  'Payouts',
  'Account Management',
  'Troubleshooting',
  'Best Practices',
];

export default function AdminResources() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [filter, setFilter] = useState<'all' | ResourceAudience>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ResourceType>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    resource_type: 'text' as ResourceType,
    target_audience: 'all' as ResourceAudience,
    content_text: '',
    external_url: '',
    category: '',
    is_published: true,
    is_featured: false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['admin-resources'],
    queryFn: () => getAllResources(),
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { file_url?: string; file_size?: number }) => {
      return createResource({
        ...data,
        created_by: user?.id || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Resource> }) =>
      updateResource(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteResource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
    },
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingResource(null);
    setSelectedFile(null);
    setFormData({
      title: '',
      description: '',
      resource_type: 'text',
      target_audience: 'all',
      content_text: '',
      external_url: '',
      category: '',
      is_published: true,
      is_featured: false,
    });
  };

  const openCreateModal = () => {
    setEditingResource(null);
    setIsModalOpen(true);
  };

  const openEditModal = (resource: Resource) => {
    setEditingResource(resource);
    setFormData({
      title: resource.title,
      description: resource.description || '',
      resource_type: resource.resource_type,
      target_audience: resource.target_audience,
      content_text: resource.content_text || '',
      external_url: resource.external_url || '',
      category: resource.category || '',
      is_published: resource.is_published,
      is_featured: resource.is_featured,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      let file_url: string | undefined;
      let file_size: number | undefined;

      // Upload file if selected
      if (selectedFile && (formData.resource_type === 'video' || formData.resource_type === 'image')) {
        const result = await uploadResourceFile(selectedFile, formData.resource_type);
        file_url = result.url;
        file_size = result.size;
      }

      if (editingResource) {
        await updateMutation.mutateAsync({
          id: editingResource.id,
          data: {
            ...formData,
            file_url: file_url || editingResource.file_url,
            file_size: file_size || editingResource.file_size,
          },
        });
      } else {
        await createMutation.mutateAsync({
          ...formData,
          file_url,
          file_size,
        });
      }
    } catch (error) {
      console.error('Error saving resource:', error);
      alert('Failed to save resource');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (resource: Resource) => {
    if (confirm(`Delete "${resource.title}"? This cannot be undone.`)) {
      deleteMutation.mutate(resource.id);
    }
  };

  const togglePublished = (resource: Resource) => {
    updateMutation.mutate({
      id: resource.id,
      data: { is_published: !resource.is_published },
    });
  };

  const toggleFeatured = (resource: Resource) => {
    updateMutation.mutate({
      id: resource.id,
      data: { is_featured: !resource.is_featured },
    });
  };

  const filteredResources = resources.filter(r => {
    if (filter !== 'all' && r.target_audience !== filter && r.target_audience !== 'all') {
      return false;
    }
    if (typeFilter !== 'all' && r.resource_type !== typeFilter) {
      return false;
    }
    return true;
  });

  const getTypeIcon = (type: ResourceType) => {
    switch (type) {
      case 'video': return '🎬';
      case 'image': return '🖼️';
      case 'text': return '📄';
    }
  };

  const getAudienceLabel = (audience: ResourceAudience) => {
    switch (audience) {
      case 'managers': return 'Managers';
      case 'partners': return 'Partners';
      case 'all': return 'Everyone';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="admin-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>Resource Center</h1>
            <p>Manage learning materials for managers and partners</p>
          </div>
          <button className="primary-btn" onClick={openCreateModal}>
            + Add Resource
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">Audience:</span>
          <button
            className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={filter === 'managers' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('managers')}
          >
            Managers
          </button>
          <button
            className={filter === 'partners' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilter('partners')}
          >
            Partners
          </button>
        </div>
        <div className="filter-group">
          <span className="filter-label">Type:</span>
          <button
            className={typeFilter === 'all' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setTypeFilter('all')}
          >
            All
          </button>
          <button
            className={typeFilter === 'video' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setTypeFilter('video')}
          >
            Videos
          </button>
          <button
            className={typeFilter === 'image' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setTypeFilter('image')}
          >
            Images
          </button>
          <button
            className={typeFilter === 'text' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setTypeFilter('text')}
          >
            Text
          </button>
        </div>
      </div>

      {/* Resources List */}
      {isLoading ? (
        <div className="loading">Loading resources...</div>
      ) : filteredResources.length === 0 ? (
        <div className="empty-state">
          <p>No resources found. Click "Add Resource" to create one.</p>
        </div>
      ) : (
        <div className="resources-grid">
          {filteredResources.map(resource => (
            <div key={resource.id} className={`resource-card ${!resource.is_published ? 'unpublished' : ''}`}>
              <div className="resource-card-header">
                <span className="resource-type-icon">{getTypeIcon(resource.resource_type)}</span>
                <div className="resource-badges">
                  {resource.is_featured && <span className="badge featured">Featured</span>}
                  {!resource.is_published && <span className="badge draft">Draft</span>}
                  <span className={`badge audience-${resource.target_audience}`}>
                    {getAudienceLabel(resource.target_audience)}
                  </span>
                </div>
              </div>

              <h3 className="resource-title">{resource.title}</h3>
              {resource.description && (
                <p className="resource-description">{resource.description}</p>
              )}

              <div className="resource-meta">
                {resource.category && <span className="category-tag">{resource.category}</span>}
                {resource.file_size && <span className="file-size">{formatFileSize(resource.file_size)}</span>}
                <span className="view-count">{resource.view_count} views</span>
              </div>

              <div className="resource-actions">
                <button className="icon-btn" onClick={() => togglePublished(resource)} title={resource.is_published ? 'Unpublish' : 'Publish'}>
                  {resource.is_published ? '👁️' : '👁️‍🗨️'}
                </button>
                <button className="icon-btn" onClick={() => toggleFeatured(resource)} title={resource.is_featured ? 'Unfeature' : 'Feature'}>
                  {resource.is_featured ? '⭐' : '☆'}
                </button>
                <button className="icon-btn" onClick={() => openEditModal(resource)} title="Edit">
                  ✏️
                </button>
                <button className="icon-btn danger" onClick={() => handleDelete(resource)} title="Delete">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal resource-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>&times;</button>
            <h2>{editingResource ? 'Edit Resource' : 'Add Resource'}</h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="e.g., How to Log a Transaction"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this resource..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Type *</label>
                  <select
                    value={formData.resource_type}
                    onChange={e => setFormData({ ...formData, resource_type: e.target.value as ResourceType })}
                  >
                    <option value="text">Text / Article</option>
                    <option value="video">Video</option>
                    <option value="image">Image</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Target Audience *</label>
                  <select
                    value={formData.target_audience}
                    onChange={e => setFormData({ ...formData, target_audience: e.target.value as ResourceAudience })}
                  >
                    <option value="all">Everyone</option>
                    <option value="managers">Managers Only</option>
                    <option value="partners">Partners Only</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">Select category...</option>
                  {RESOURCE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Content based on type */}
              {formData.resource_type === 'text' && (
                <div className="form-group">
                  <label>Content *</label>
                  <textarea
                    value={formData.content_text}
                    onChange={e => setFormData({ ...formData, content_text: e.target.value })}
                    placeholder="Write your article content here... (Markdown supported)"
                    rows={10}
                    required
                  />
                </div>
              )}

              {formData.resource_type === 'video' && (
                <>
                  <div className="form-group">
                    <label>Video URL (YouTube, Vimeo, etc.)</label>
                    <input
                      type="url"
                      value={formData.external_url}
                      onChange={e => setFormData({ ...formData, external_url: e.target.value })}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Or Upload Video File</label>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    />
                    {editingResource?.file_url && !selectedFile && (
                      <p className="current-file">Current file: {editingResource.file_url.split('/').pop()}</p>
                    )}
                  </div>
                </>
              )}

              {formData.resource_type === 'image' && (
                <div className="form-group">
                  <label>Upload Image *</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    required={!editingResource?.file_url}
                  />
                  {editingResource?.file_url && !selectedFile && (
                    <div className="current-image">
                      <img src={editingResource.file_url} alt="Current" />
                    </div>
                  )}
                </div>
              )}

              <div className="form-row checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_published}
                    onChange={e => setFormData({ ...formData, is_published: e.target.checked })}
                  />
                  Published
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_featured}
                    onChange={e => setFormData({ ...formData, is_featured: e.target.checked })}
                  />
                  Featured
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={isUploading || createMutation.isPending || updateMutation.isPending}
                >
                  {isUploading ? 'Uploading...' : editingResource ? 'Save Changes' : 'Create Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
