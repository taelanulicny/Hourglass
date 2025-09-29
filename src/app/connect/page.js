"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// --- Tab Components -----------------------------------------------------


function ResourcesTab({ focusAreas = [], onPersonSelect, onResourceSelect, savedResources = [], onSaveResource, onRemoveResource, onTabChange, isResourceSaved, onShowVault, showVaultContent = false, onBackToResources }) {
  const DEMO = [{ id:'lsat', name:'LSAT Prep' }, { id:'fitness', name:'Fitness' }];
  
  // Convert focus areas to the format expected by the selector
  const areas = focusAreas.length > 0 
    ? focusAreas.map(area => ({ id: area.label, name: area.label }))
    : [];
    
  const [selectedId, setSelectedId] = useState(areas[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // Check for AI search query on mount
  useEffect(() => {
    const aiQuery = localStorage.getItem('aiSearchQuery');
    if (aiQuery) {
      setSearchQuery(aiQuery);
      // Clear the stored query
      localStorage.removeItem('aiSearchQuery');
      // Trigger the search
      handleSearch(aiQuery);
    }
  }, []);

  // Handle AI search for resources
  const handleSearch = async (query = null) => {
    console.log('handleSearch called with query:', query, 'searchQuery:', searchQuery);
    const searchTerm = query || searchQuery;
    console.log('searchTerm:', searchTerm);
    if (!searchTerm.trim()) {
      console.log('No search term, returning');
      return;
    }
    
    console.log('Starting search for:', searchTerm);
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const response = await fetch('/api/ai/resources/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchTerm }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch resources');
      }

      setSearchResults(data);
    } catch (error) {
      console.error('Error fetching resources:', error);
      setSearchError(error.message);
    } finally {
      setIsSearching(false);
    }
  };

  // Note: We now always show the discover page with default resources, even without focus areas

  // If showing vault content, render the vault page
  if (showVaultContent) {
    return (
      <div className="space-y-4">
        {/* Vault Content */}
        <MyLearningPathTab 
          savedResources={savedResources} 
          onRemoveResource={onRemoveResource} 
          onResourceSelect={onResourceSelect} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white px-3 py-2 -mt-2">
        <div className="text-xs text-gray-500 mb-2">Tell your AI Assistant what you want to learn more about, and it will pull resources for you to choose from</div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Try: Entrepreneurship"
            className="flex-1 rounded-lg border px-3 py-2 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            type="button"
            onClick={() => {
              console.log('Find button clicked, searchQuery:', searchQuery);
              handleSearch();
            }}
            disabled={isSearching}
            className="px-4 py-2 bg-[#6B7280] text-white rounded-lg text-sm font-medium hover:bg-[#5B6B73] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Finding...' : 'Find'}
          </button>
      </div>
        {searchQuery && (
          <div className="mt-2 flex items-center justify-end">
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults(null);
                setIsSearching(false);
                setSearchError(null);
              }}
              className="text-xs text-[#6B7280] hover:text-[#5B6B73] font-medium"
            >
              Clear
            </button>
          </div>
        )}
        {searchError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-xs text-red-600">
              Error: {searchError}
            </div>
          </div>
        )}
      </div>


      {/* Books Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Books</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {(searchResults?.books || [
            { title: "$100M Offers", desc: "How to make offers so good people feel stupid saying no", url: "https://amazon.com/dp/1737475715", author: "Alex Hormozi" },
            { title: "Zero to One", desc: "Notes on startups, or how to build the future", url: "https://amazon.com/dp/0804139296", author: "Peter Thiel" },
            { title: "Atomic Habits", desc: "Build good habits and break bad ones", url: "https://amazon.com/dp/0735211299", author: "James Clear" },
            { title: "Deep Work", desc: "Rules for focused success in a distracted world", url: "https://amazon.com/dp/1455586692", author: "Cal Newport" },
            { title: "The Lean Startup", desc: "How today's entrepreneurs use continuous innovation", url: "https://amazon.com/dp/0307887898", author: "Eric Ries" }
          ]).map((book, index) => (
            <div key={index} className="flex-shrink-0 w-64">
              <ResourceCard 
                title={book.title} 
                desc={book.desc} 
                url={book.url} 
                type="book" 
                author={book.author} 
                spotifyUrl={book.spotifyUrl} 
                onResourceClick={onResourceSelect}
              />
            </div>
          ))}
        </div>
      </div>

      {/* People & Social Media Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">People & Social Media</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {(searchResults?.social || [
            { 
              name: "David Goggins", 
              desc: "Former Navy SEAL, ultra-endurance athlete, and motivational speaker", 
              socialLinks: [
                { platform: "X", handle: "@davidgoggins", url: "https://x.com/davidgoggins", icon: "X" },
                { platform: "Instagram", handle: "@davidgoggins", url: "https://instagram.com/davidgoggins", icon: "Instagram" },
                { platform: "YouTube", handle: "David Goggins", url: "https://youtube.com/@DavidGoggins", icon: "YouTube" },
                { platform: "Website", handle: "davidgoggins.com", url: "https://davidgoggins.com", icon: "Website" }
              ]
            },
            { 
              name: "Alex Hormozi", 
              desc: "Serial entrepreneur, gym owner, and business educator", 
              socialLinks: [
                { platform: "X", handle: "@AlexHormozi", url: "https://x.com/AlexHormozi", icon: "X" },
                { platform: "LinkedIn", handle: "alex-hormozi", url: "https://linkedin.com/in/alex-hormozi", icon: "LinkedIn" },
                { platform: "YouTube", handle: "Alex Hormozi", url: "https://youtube.com/@AlexHormozi", icon: "YouTube" },
                { platform: "Instagram", handle: "@hormozi", url: "https://instagram.com/hormozi", icon: "Instagram" }
              ]
            },
            { 
              name: "Gary Vaynerchuk", 
              desc: "Entrepreneur, CEO of VaynerMedia, and social media expert", 
              socialLinks: [
                { platform: "X", handle: "@garyvee", url: "https://x.com/garyvee", icon: "X" },
                { platform: "LinkedIn", handle: "garyvaynerchuk", url: "https://linkedin.com/in/garyvaynerchuk", icon: "LinkedIn" },
                { platform: "YouTube", handle: "GaryVee", url: "https://youtube.com/@GaryVee", icon: "YouTube" },
                { platform: "Instagram", handle: "@garyvee", url: "https://instagram.com/garyvee", icon: "Instagram" }
              ]
            },
            { 
              name: "Naval Ravikant", 
              desc: "Entrepreneur, investor, and philosopher", 
              socialLinks: [
                { platform: "X", handle: "@naval", url: "https://x.com/naval", icon: "X" },
                { platform: "LinkedIn", handle: "naval-ravikant", url: "https://linkedin.com/in/naval-ravikant", icon: "LinkedIn" },
                { platform: "YouTube", handle: "Naval Ravikant", url: "https://youtube.com/@naval", icon: "YouTube" }
              ]
            },
            { 
              name: "Paul Graham", 
              desc: "Co-founder of Y Combinator, essayist", 
              socialLinks: [
                { platform: "X", handle: "@paulg", url: "https://x.com/paulg", icon: "X" },
                { platform: "Website", handle: "paulgraham.com", url: "https://paulgraham.com", icon: "Website" },
                { platform: "GitHub", handle: "@paulg", url: "https://github.com/paulg", icon: "GitHub" }
              ]
            },
            { 
              name: "Reid Hoffman", 
              desc: "Co-founder of LinkedIn, entrepreneur and investor", 
              socialLinks: [
                { platform: "X", handle: "@reidhoffman", url: "https://x.com/reidhoffman", icon: "X" },
                { platform: "LinkedIn", handle: "reidhoffman", url: "https://linkedin.com/in/reidhoffman", icon: "LinkedIn" },
                { platform: "Website", handle: "reidhoffman.org", url: "https://reidhoffman.org", icon: "Website" }
              ]
            }
          ]).map((person, index) => (
            <div key={index} className="flex-shrink-0 w-64">
              <PersonCard 
                person={person} 
                onClick={onPersonSelect}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Podcasts Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Podcasts</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {(searchResults?.podcasts || [
            { title: "Founders", desc: "Biographies of the world's greatest entrepreneurs by David Senra", url: "https://podcasts.apple.com/podcast/id1141877104", spotifyUrl: "https://open.spotify.com/search/Founders%20podcast" },
            { title: "The Tim Ferriss Show", desc: "Interviews with world-class performers", url: "https://podcasts.apple.com/podcast/id863897795", spotifyUrl: "https://open.spotify.com/search/The%20Tim%20Ferriss%20Show" },
            { title: "How I Built This", desc: "Stories behind successful companies", url: "https://podcasts.apple.com/podcast/id1154105909", spotifyUrl: "https://open.spotify.com/search/How%20I%20Built%20This" },
            { title: "The GaryVee Audio Experience", desc: "Business insights and motivational content", url: "https://podcasts.apple.com/podcast/id928159684", spotifyUrl: "https://open.spotify.com/search/The%20GaryVee%20Audio%20Experience" },
            { title: "Masters of Scale", desc: "How great companies grow from zero to a gazillion", url: "https://podcasts.apple.com/podcast/id1227971746", spotifyUrl: "https://open.spotify.com/search/Masters%20of%20Scale" }
          ]).map((podcast, index) => (
            <div key={index} className="flex-shrink-0 w-64">
              <ResourceCard 
                title={podcast.title} 
                desc={podcast.desc} 
                url={podcast.url} 
                type="podcast" 
                spotifyUrl={podcast.spotifyUrl} 
                onResourceClick={onResourceSelect}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Enter The Vault Button */}
      <button
        onClick={onShowVault}
        className="w-full py-4 bg-gradient-to-r from-[#6B7280] to-[#5B6B73] text-white font-bold text-lg tracking-widest uppercase rounded-lg hover:from-[#5B6B73] hover:to-[#4B5563] transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center gap-3"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        V A U L T
      </button>
    </div>
  );
}



// --- Sample feed card --------------------------------------------------------
function FeedCard({ title, children, cta }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="font-semibold text-[#374151] mb-1">{title}</div>
      <div className="text-[13px] text-[#6B7280] mb-3">{children}</div>
      {cta && (
        <button className="px-3 py-1.5 rounded-lg border border-[#374151] text-[#374151] text-sm">
          {cta}
        </button>
      )}
    </div>
  );
}

  // --- Social Media Icon Component ------------------------------------------
  function SocialMediaIcon({ platform, className = "" }) {
    const getLogo = (platform) => {
      switch (platform) {
        case 'X':
  return (
            <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          );
        case 'LinkedIn':
          return (
            <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          );
        case 'YouTube':
          return (
            <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          );
        case 'Instagram':
          return (
            <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          );
        case 'GitHub':
          return (
            <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          );
        case 'Website':
          return (
            <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1 17.898c-3.741 0-6.898-2.157-6.898-5.898S7.259 6.102 11 6.102c1.856 0 3.5.727 4.5 1.898l-1.5 1.5c-.5-.5-1.5-.898-2.5-.898-2.344 0-4 1.656-4 4s1.656 4 4 4c1 0 2-.398 2.5-.898l1.5 1.5c-1 1.171-2.644 1.898-4.5 1.898zm8-1.898l-1.5-1.5c.5-.5.5-1.5.5-2.5s0-2-.5-2.5l1.5-1.5c1 1.171 1.5 2.644 1.5 4.5s-.5 3.329-1.5 4.5zm-3.5-6.5c-.5.5-.5 1.5-.5 2.5s0 2 .5 2.5l-1.5 1.5c-1-1.171-1.5-2.644-1.5-4.5s.5-3.329 1.5-4.5l1.5 1.5z"/>
            </svg>
          );
        default:
          return <span className={`text-sm ${className}`}>{platform}</span>;
      }
    };

    return getLogo(platform);
  }

  function PersonCard({ person, onClick, showRemoveButton = false, onRemove }) {

    const handleRemove = (e) => {
      e.stopPropagation();
      if (showRemoveButton && onRemove) {
        onRemove();
      }
      // If not showRemoveButton, this is just showing "Added!" status
    };

    return (
      <div 
        className="block rounded-xl border hover:shadow-sm bg-white p-4 cursor-pointer h-24 relative"
        onClick={() => onClick(person)}
      >
        <div className="flex items-start gap-3 h-full">
          {/* Icon */}
          <div className="text-2xl flex-shrink-0 mt-0.5">
            👤
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="font-semibold leading-snug text-base line-clamp-1 mb-1">{person.name}</div>
            <div className="text-sm text-gray-500 line-clamp-2">{person.desc}</div>
          </div>

          {/* Save/Remove Button - Only show in Vault page */}
          {showRemoveButton && (
            <div className="flex-shrink-0">
              <button
                onClick={handleRemove}
                className="text-red-500 hover:text-red-700 text-sm font-medium"
                title="Remove from Vault"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

// --- Resource Preview Modal ------------------------------------------
function ResourcePreviewModal({ resource, isOpen, onClose, onSave, isSaved }) {
  if (!isOpen || !resource) return null;

  const handleVisitResource = () => {
    if (resource.type === 'podcast' && resource.spotifyUrl) {
      window.open(resource.spotifyUrl, '_blank', 'noopener,noreferrer');
    } else if (resource.url) {
      window.open(resource.url, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  const getResourceIcon = (type) => {
    switch (type) {
      case 'book':
        return '📖';
      case 'podcast':
        return '🎧';
      case 'social':
        return '👤';
      default:
        return '📚';
    }
  };

  const getResourceTypeLabel = (type) => {
    switch (type) {
      case 'book':
        return 'Book';
      case 'podcast':
        return 'Podcast';
      case 'social':
        return 'Person';
      default:
        return 'Resource';
    }
  };

  const getActionButtonText = (type) => {
    switch (type) {
      case 'book':
        return 'View on Amazon';
      case 'podcast':
        return 'Listen on Spotify';
      case 'social':
        return 'View Social Profiles';
      default:
        return 'Visit Resource';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="text-3xl">
            {getResourceIcon(resource.type)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{resource.title || resource.name}</h2>
            <p className="text-sm text-gray-500">{getResourceTypeLabel(resource.type)}</p>
          </div>
          {/* Add to Vault Button */}
          {onSave && (
            <button
              onClick={() => {
                const resourceToSave = {
                  id: `${resource.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  title: resource.title,
                  name: resource.name,
                  desc: resource.desc,
                  url: resource.url,
                  type: resource.type,
                  author: resource.author,
                  spotifyUrl: resource.spotifyUrl,
                  socialLinks: resource.socialLinks
                };
                onSave(resourceToSave);
              }}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                isSaved 
                  ? 'bg-gray-100 text-gray-600 cursor-default' 
                  : 'bg-gray-200 text-black hover:bg-gray-300'
              }`}
              disabled={isSaved}
            >
              {isSaved ? 'Added!' : '+ Add to Vault'}
            </button>
          )}
        </div>

        {/* Resource Info */}
        <div className="mb-6">
          {resource.type === 'book' && resource.author && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-700 mb-1">Author</p>
              <p className="text-gray-600">{resource.author}</p>
            </div>
          )}
          
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
            <p className="text-gray-600 leading-relaxed">{resource.desc}</p>
          </div>

          {resource.type === 'social' && resource.socialLinks && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Available on</p>
              <div className="flex flex-wrap gap-2">
                {resource.socialLinks.slice(0, 4).map((link, index) => (
                  <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs">
                    <SocialMediaIcon platform={link.platform} />
                    <span>{link.platform}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleVisitResource}
            className="flex-1 bg-[#6B7280] hover:bg-[#5B6B73] text-white py-3 rounded-xl font-medium transition-colors"
          >
            {getActionButtonText(resource.type)}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

  function ResourceCard({ title, desc, url, type = 'book', author, spotifyUrl, onResourceClick, name, socialLinks, showRemoveButton = false, onRemove }) {
    // Determine the appropriate icon based on type
    const getIcon = (type) => {
      switch (type) {
        case 'book':
          return '📖';
        case 'podcast':
          return '🎧';
        case 'social':
          return '👤';
        default:
          return '📚';
      }
    };

    const handleClick = () => {
      if (onResourceClick) {
        // For podcasts, always use search URL format for AI results to ensure mobile compatibility
        let finalSpotifyUrl = spotifyUrl;
        if (type === 'podcast') {
          // For AI search results, always use search format instead of show URLs
          // This ensures mobile compatibility and works like the fallback podcasts
          const searchTitle = encodeURIComponent((title || name) + ' podcast');
          finalSpotifyUrl = `https://open.spotify.com/search/${searchTitle}`;
        }

        onResourceClick({
          title: title || name,
          desc,
          url,
          type,
          author,
          spotifyUrl: finalSpotifyUrl,
          socialLinks
        });
      }
    };


    const handleRemove = (e) => {
      e.stopPropagation();
      if (showRemoveButton && onRemove) {
        onRemove();
      }
      // If not showRemoveButton, this is just showing "Added!" status
    };

    return (
      <div className="block rounded-xl border hover:shadow-sm bg-white p-4 cursor-pointer h-24 relative" onClick={handleClick}>
        <div className="flex items-start gap-3 h-full">
          {/* Icon */}
          <div className="text-2xl flex-shrink-0 mt-0.5">
            {getIcon(type)}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="font-semibold leading-snug text-base line-clamp-1 mb-1">{title || name}</div>
            {type === 'book' && author ? (
              <div className="text-sm text-gray-600 line-clamp-2">by {author}</div>
            ) : (
              <div className="text-sm text-gray-500 line-clamp-2">{desc}</div>
            )}
          </div>

          {/* Save/Remove Button - Only show in Vault page */}
          {showRemoveButton && (
            <div className="flex-shrink-0">
              <button
                onClick={handleRemove}
                className="text-red-500 hover:text-red-700 text-sm font-medium"
                title="Remove from Vault"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

// --- Person Social Media Modal ------------------------------------------
function PersonSocialModal({ person, isOpen, onClose, onSave, isSaved }) {
  if (!isOpen || !person) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
            👤
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-xl">{person.name}</h3>
            <p className="text-sm text-gray-600">{person.desc}</p>
          </div>
          {/* Add to Vault Button */}
          {onSave && (
            <button
              onClick={() => {
                const resourceToSave = {
                  id: `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  name: person.name,
                  desc: person.desc,
                  socialLinks: person.socialLinks,
                  type: 'person'
                };
                onSave(resourceToSave);
              }}
              className={`px-4 py-2 rounded-lg font-medium text-sm ${
                isSaved 
                  ? 'bg-gray-100 text-gray-600 cursor-default' 
                  : 'bg-gray-200 text-black hover:bg-gray-300'
              }`}
              disabled={isSaved}
            >
              {isSaved ? 'Added!' : '+ Add to Vault'}
            </button>
          )}
        </div>

        {/* Social media links */}
        <div className="space-y-3 mb-6">
          <p className="text-sm text-gray-500 font-medium">Follow on:</p>
          {person.socialLinks.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <SocialMediaIcon platform={link.platform} className="text-2xl" />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{link.platform}</div>
                <div className="text-sm text-gray-500">{link.handle}</div>
              </div>
              <span className="text-gray-400">→</span>
            </a>
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}


// My Learning Path Tab Component
function MyLearningPathTab({ savedResources, onRemoveResource, onResourceSelect }) {
  if (savedResources.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-2 text-lg">The Vault is Empty</div>
        <div className="text-sm text-gray-400 mb-4">
          Save resources from the Resources tab to build your personal collection
        </div>
        <div className="text-xs text-gray-400">
          Look for the "+ Add" button on books, people, and podcasts
        </div>
      </div>
    );
  }

  // Group resources by type
  const books = savedResources.filter(r => r.type === 'book');
  const people = savedResources.filter(r => r.type === 'person');
  const podcasts = savedResources.filter(r => r.type === 'podcast');

  return (
    <div className="space-y-4">
      <div className="text-center mb-1">
        <p className="text-xs text-gray-600">
          Welcome to your personal collection of resources to help you grow
        </p>
      </div>

      {/* Books Section */}
      {books.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-3">Books ({books.length})</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {books.map((book, index) => (
              <div key={book.id || index} className="flex-shrink-0 w-64">
                <ResourceCard 
                  title={book.title} 
                  desc={book.desc} 
                  url={book.url} 
                  type="book" 
                  author={book.author} 
                  onResourceClick={onResourceSelect}
                  isSaved={true}
                  showRemoveButton={true}
                  onRemove={() => onRemoveResource(book.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* People Section */}
      {people.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-3">People ({people.length})</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {people.map((person, index) => (
              <div key={person.id || index} className="flex-shrink-0 w-64">
                <ResourceCard 
                  name={person.name} 
                  desc={person.desc} 
                  socialLinks={person.socialLinks} 
                  type="person" 
                  onResourceClick={onResourceSelect}
                  isSaved={true}
                  showRemoveButton={true}
                  onRemove={() => onRemoveResource(person.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Podcasts Section */}
      {podcasts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-lg font-semibold mb-3">Podcasts ({podcasts.length})</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {podcasts.map((podcast, index) => (
              <div key={podcast.id || index} className="flex-shrink-0 w-64">
                <ResourceCard 
                  title={podcast.title} 
                  desc={podcast.desc} 
                  url={podcast.url} 
                  type="podcast" 
                  author={podcast.author}
                  spotifyUrl={podcast.spotifyUrl}
                  onResourceClick={onResourceSelect}
                  isSaved={true}
                  showRemoveButton={true}
                  onRemove={() => onRemoveResource(podcast.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConnectPage() {
  // --- TODO: replace with real "today" values from your store/localStorage ---
  const myToday = useMemo(() => ({ goalMins: 240, spentMins: 36, color: "#7EA2B7", name: "My Progress" }), []);
  const percentMine = useMemo(() => (myToday.goalMins ? (myToday.spentMins / myToday.goalMins) * 100 : 0), [myToday]);
  
  // --- State ---
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [showVaultContent, setShowVaultContent] = useState(false);
  const router = useRouter();

  // Load user's focus areas from localStorage
  const [focusAreas, setFocusAreas] = useState([]);
  
  // Load focus areas on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("focusCategories");
      const parsed = raw ? JSON.parse(raw) : [];
      const areas = Array.isArray(parsed) ? parsed : [];
      setFocusAreas(areas);
    } catch (error) {
      console.warn('Failed to load focus areas:', error);
      setFocusAreas([]);
    }
  }, []);

  // Load saved resources (My Learning Path) on mount
  const [savedResources, setSavedResources] = useState([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("myLearningPath");
      const parsed = raw ? JSON.parse(raw) : [];
      const resources = Array.isArray(parsed) ? parsed : [];
      setSavedResources(resources);
    } catch (error) {
      console.warn('Failed to load saved resources:', error);
      setSavedResources([]);
    }
  }, []);

  // Helper function to check if a resource is already saved
  const isResourceSaved = (resource) => {
    return savedResources.some(saved => {
      // For people, compare name; for books/podcasts, compare title
      const resourceName = resource.title || resource.name;
      const savedName = saved.title || saved.name;
      
      // For people, only compare name and type (no author field)
      if (resource.type === 'person') {
        return savedName === resourceName && saved.type === resource.type;
      }
      
      // For books/podcasts, compare title, type, and author
      return savedName === resourceName && 
             saved.type === resource.type &&
             (saved.author === resource.author || saved.author === resource.name);
    });
  };

  // Save resources to localStorage
  const saveResource = (resource) => {
    const newSavedResources = [...savedResources, { ...resource, savedAt: new Date().toISOString() }];
    setSavedResources(newSavedResources);
    localStorage.setItem("myLearningPath", JSON.stringify(newSavedResources));
  };

  // Remove resource from saved list
  const removeSavedResource = (resourceId) => {
    const newSavedResources = savedResources.filter(r => r.id !== resourceId);
    setSavedResources(newSavedResources);
    localStorage.setItem("myLearningPath", JSON.stringify(newSavedResources));
  };



  // Fake follows — later, fetch from /api/connect or local cache
  const follows = [
    { name: "Noah R.", percent: 12, color: "#7EA2B7" },
    { name: "Ava M.", percent: 15, color: "#7EA2B7" },
    { name: "Noah R.", percent: 12, color: "#7EA2B7" },
    { name: "Sam T.", percent: 34, color: "#7EA2B7" },
    { name: "Priya", percent: 68, color: "#7EA2B7" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#374151] pb-36">
      {/* Header */}
      <header className="px-4 pt-16 pb-3">
        <div className="flex items-center justify-between mb-2">
          {/* Left: Back button when in vault, empty space otherwise */}
          {showVaultContent ? (
            <button
              onClick={() => setShowVaultContent(false)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : (
            <div className="w-10 h-10"></div>
          )}

          {/* Center: Title */}
          {showVaultContent ? (
            <div className="text-lg font-bold tracking-widest uppercase">
              V A U L T
            </div>
          ) : (
            <div className="text-lg font-bold tracking-widest uppercase">
              R E S O U R C E S
            </div>
          )}

          {/* Right: Settings button */}
          <button
            onClick={() => router.push('/settings')}
            title="Settings"
            aria-label="Settings"
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition-colors duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>

        {/* Divider line */}
        <hr className="border-gray-200 mb-3" />
      </header>



      {/* Content */}
      <main className="px-4 mt-4">
        <ResourcesTab 
          focusAreas={focusAreas} 
          onPersonSelect={setSelectedPerson} 
          onResourceSelect={setSelectedResource} 
          savedResources={savedResources} 
          onSaveResource={saveResource} 
          onRemoveResource={removeSavedResource} 
          isResourceSaved={isResourceSaved} 
          onShowVault={() => setShowVaultContent(true)} 
          showVaultContent={showVaultContent} 
          onBackToResources={() => setShowVaultContent(false)} 
        />
      </main>

      {/* Bottom nav (matches your style) */}
      <nav className="fixed bottom-0 left-0 right-0 p-3 pb-7 z-[9999]">
        <div className="max-w-md mx-auto grid grid-cols-3 gap-3">
          <Link
            href="/"
            className="h-12 w-full rounded-2xl bg-white text-gray-700 font-medium border-2 border-gray-200 hover:bg-gray-50 transition-colors duration-200 shadow-sm grid place-items-center"
          >
            Dashboard
          </Link>
          <Link
            href="/calendar"
            className="h-12 w-full rounded-2xl bg-white text-gray-700 font-medium border-2 border-gray-200 hover:bg-gray-50 transition-colors duration-200 shadow-sm grid place-items-center"
          >
            Calendar
          </Link>
          <button
            className="h-12 w-full rounded-2xl bg-gray-900 text-white font-semibold shadow-lg grid place-items-center justify-center"
            aria-current="page"
            disabled
          >
            Discover
          </button>
        </div>
      </nav>

      {/* No-scrollbar utility styles */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Person Social Media Modal */}
      <PersonSocialModal 
        person={selectedPerson}
        isOpen={!!selectedPerson}
        onClose={() => setSelectedPerson(null)}
        onSave={saveResource}
        isSaved={selectedPerson ? isResourceSaved({ name: selectedPerson.name, type: 'person', author: selectedPerson.name }) : false}
      />

      {/* Resource Preview Modal */}
      <ResourcePreviewModal 
        resource={selectedResource}
        isOpen={!!selectedResource}
        onClose={() => setSelectedResource(null)}
        onSave={saveResource}
        isSaved={selectedResource ? isResourceSaved(selectedResource) : false}
      />


    </div>
  );
}