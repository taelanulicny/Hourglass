"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// --- Tab Components -----------------------------------------------------
function FeedTab() { 
  return (
    <div className="space-y-2">
      {/* Close Friends section */}
      <section aria-label="Close friends" className="mb-2">
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-3">
          {/* Module title */}
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Close Friends (coming soon)
          </h3>

          {/* Rings row */}
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
            <StoryRing percent={15} label="My Progress" tint="#7EA2B7" />
            <StoryRing percent={12} label="Ryan S." tint="#7EA2B7" />
            <StoryRing percent={15} label="Ava M." tint="#7EA2B7" />
            <StoryRing percent={12} label="Noah R." tint="#7EA2B7" />
            <StoryRing percent={34} label="Sam T." tint="#7EA2B7" />
          </div>
        </div>
      </section>

      <FocusAreaPost
        author="Jordan Lee"
        handle="@jordan"
        title="Run"
        weekLabel="Aug 11–17"
        color="#7EA2B7"
        dailyGoalHrs={2}
        dayRatios={[1, 1, 1, 1, 1, 1, 1]}
      />

      <FocusAreaPost
        author="Chris Park"
        handle="@chris"
        title="Study"
        weekLabel="Aug 11–17"
        color="#B7A27E"
        dailyGoalHrs={3}
        dayRatios={[1, 1.3, 1, 0.5, 1, 1, 1]}
      />

      <FocusAreaSlideshowPost />
    </div>
  );
}

function ChallengesTab() { 
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Active Challenges (coming soon)</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div>
              <div className="font-medium">7-Day Study Streak</div>
              <div className="text-sm text-gray-600">3 days remaining</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">4/7</div>
              <div className="text-xs text-gray-500">days</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div>
              <div className="font-medium">Morning Routine</div>
              <div className="text-sm text-gray-600">21-day challenge</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">12/21</div>
              <div className="text-xs text-gray-500">days</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourcesTab({ focusAreas = [], onPodcastSelect, onPersonSelect }) {
  const DEMO = [{ id:'lsat', name:'LSAT Prep' }, { id:'fitness', name:'Fitness' }];
  
  // Convert focus areas to the format expected by the selector
  const areas = focusAreas.length > 0 
    ? focusAreas.map(area => ({ id: area.label, name: area.label }))
    : [];
    
  const [selectedId, setSelectedId] = useState(areas[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Handle AI search for resources
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    
    try {
      const response = await fetch('/api/ai/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch resources');
      }

      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error fetching resources:', error);
      
      // Fallback to simulated results if API fails
      setSearchResults({
        query: searchQuery,
        books: [
          { title: `${searchQuery} - Essential Guide`, desc: `Comprehensive resource for ${searchQuery}`, url: `https://example.com/${searchQuery.replace(/\s+/g, '-').toLowerCase()}-guide`, thumbnail: `https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&h=200&fit=crop` },
          { title: `Mastering ${searchQuery}`, desc: `Advanced techniques and strategies`, url: `https://example.com/mastering-${searchQuery.replace(/\s+/g, '-').toLowerCase()}`, thumbnail: `https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=200&fit=crop` },
          { title: `${searchQuery} for Beginners`, desc: `Perfect starting point for newcomers`, url: `https://example.com/${searchQuery.replace(/\s+/g, '-').toLowerCase()}-beginners`, thumbnail: `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop` }
        ],
        podcasts: [
          { title: `${searchQuery} Podcast`, desc: `Weekly insights and discussions`, url: `https://example.com/${searchQuery.replace(/\s+/g, '-').toLowerCase()}-podcast`, thumbnail: `https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop` },
          { title: `The ${searchQuery} Show`, desc: `Expert interviews and tips`, url: `https://example.com/${searchQuery.replace(/\s+/g, '-').toLowerCase()}-show`, thumbnail: `https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&h=200&fit=crop` }
        ],
        social: [
          { 
            name: `${searchQuery} Expert 1`, 
            desc: `Leading expert in ${searchQuery}`, 
            thumbnail: `https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=200&h=200&fit=crop`,
            socialLinks: [
              { platform: "Twitter", handle: `@${searchQuery.toLowerCase().replace(/\s+/g, '')}1`, url: `https://twitter.com/${searchQuery.toLowerCase().replace(/\s+/g, '')}1`, icon: "🐦" },
              { platform: "LinkedIn", handle: `${searchQuery.toLowerCase().replace(/\s+/g, '-')}-expert`, url: `https://linkedin.com/in/${searchQuery.toLowerCase().replace(/\s+/g, '-')}-expert`, icon: "💼" },
              { platform: "YouTube", handle: `${searchQuery} Expert`, url: `https://youtube.com/@${searchQuery.toLowerCase().replace(/\s+/g, '')}expert`, icon: "📺" }
            ]
          },
          { 
            name: `${searchQuery} Expert 2`, 
            desc: `Thought leader in ${searchQuery}`, 
            thumbnail: `https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200&h=200&fit=crop`,
            socialLinks: [
              { platform: "Twitter", handle: `@${searchQuery.toLowerCase().replace(/\s+/g, '')}2`, url: `https://twitter.com/${searchQuery.toLowerCase().replace(/\s+/g, '')}2`, icon: "🐦" },
              { platform: "Instagram", handle: `@${searchQuery.toLowerCase().replace(/\s+/g, '')}expert`, url: `https://instagram.com/${searchQuery.toLowerCase().replace(/\s+/g, '')}expert`, icon: "📷" },
              { platform: "Website", handle: `${searchQuery.toLowerCase().replace(/\s+/g, '')}expert.com`, url: `https://${searchQuery.toLowerCase().replace(/\s+/g, '')}expert.com`, icon: "🌐" }
            ]
          }
        ]
      });
    } finally {
      setIsSearching(false);
    }
  };

  // If no focus areas exist, show message to add them
  if (focusAreas.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-2">No focus areas found</div>
        <div className="text-sm text-gray-400">
          Go to your dashboard and add a focus area to see personalized resources
        </div>
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
            onClick={handleSearch}
            disabled={isSearching}
            className="px-4 py-2 bg-[#8CA4AF] text-white rounded-lg text-sm font-medium hover:bg-[#7A939E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Finding...' : 'Find'}
          </button>
        </div>
        {searchQuery && (
          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              Showing resources for: <span className="font-medium">"{searchQuery}"</span>
            </div>
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults(null);
                setIsSearching(false);
              }}
              className="text-xs text-[#8CA4AF] hover:text-[#7A939E] font-medium"
            >
              Clear
            </button>
          </div>
        )}
      </div>


      {/* Books Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Books</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {(searchResults?.books || [
            { title: "Atomic Habits", desc: "Build good habits and break bad ones", url: "https://amazon.com/dp/0735211299", thumbnail: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&h=200&fit=crop", author: "James Clear" },
            { title: "Deep Work", desc: "Rules for focused success in a distracted world", url: "https://amazon.com/dp/1455586692", thumbnail: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=200&fit=crop", author: "Cal Newport" },
            { title: "The Power of Habit", desc: "Why we do what we do in life and business", url: "https://amazon.com/dp/1400069289", thumbnail: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop", author: "Charles Duhigg" },
            { title: "Getting Things Done", desc: "The art of stress-free productivity", url: "https://amazon.com/dp/0143126560", thumbnail: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=200&h=200&fit=crop", author: "David Allen" },
            { title: "The 7 Habits", desc: "Highly effective people principles", url: "https://amazon.com/dp/1982137274", thumbnail: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=200&fit=crop", author: "Stephen Covey" }
          ]).map((book, index) => (
            <div key={index} className="flex-shrink-0 w-64">
              <ResourceCard title={book.title} desc={book.desc} url={book.url} thumbnail={book.thumbnail} type="book" author={book.author} spotifyUrl={book.spotifyUrl} onPodcastClick={onPodcastSelect} />
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
              name: "Alex Hormozi", 
              desc: "Serial entrepreneur, gym owner, and business educator", 
              thumbnail: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
              socialLinks: [
                { platform: "X (Twitter)", handle: "@AlexHormozi", url: "https://twitter.com/AlexHormozi", icon: "🐦" },
                { platform: "Instagram", handle: "@alexhormozi", url: "https://instagram.com/alexhormozi", icon: "📷" },
                { platform: "YouTube", handle: "Alex Hormozi", url: "https://youtube.com/@AlexHormozi", icon: "📺" },
                { platform: "LinkedIn", handle: "alex-hormozi", url: "https://linkedin.com/in/alex-hormozi", icon: "💼" },
                { platform: "TikTok", handle: "@alexhormozi", url: "https://tiktok.com/@alexhormozi", icon: "🎵" }
              ]
            },
            { 
              name: "Naval Ravikant", 
              desc: "Entrepreneur, investor, and philosopher", 
              thumbnail: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=200&h=200&fit=crop",
              socialLinks: [
                { platform: "X (Twitter)", handle: "@naval", url: "https://twitter.com/naval", icon: "🐦" },
                { platform: "LinkedIn", handle: "naval-ravikant", url: "https://linkedin.com/in/naval-ravikant", icon: "💼" },
                { platform: "YouTube", handle: "Naval Ravikant", url: "https://youtube.com/@naval", icon: "📺" }
              ]
            },
            { 
              name: "Tim Ferriss", 
              desc: "Author, podcaster, and lifestyle designer", 
              thumbnail: "https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200&h=200&fit=crop",
              socialLinks: [
                { platform: "X (Twitter)", handle: "@tferriss", url: "https://twitter.com/tferriss", icon: "🐦" },
                { platform: "Instagram", handle: "@timferriss", url: "https://instagram.com/timferriss", icon: "📷" },
                { platform: "YouTube", handle: "Tim Ferriss", url: "https://youtube.com/@timferriss", icon: "📺" },
                { platform: "LinkedIn", handle: "tim-ferriss", url: "https://linkedin.com/in/tim-ferriss", icon: "💼" }
              ]
            },
            { 
              name: "Gary Vaynerchuk", 
              desc: "CEO of VaynerMedia, social media expert", 
              thumbnail: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
              socialLinks: [
                { platform: "X (Twitter)", handle: "@garyvee", url: "https://twitter.com/garyvee", icon: "🐦" },
                { platform: "Instagram", handle: "@garyvee", url: "https://instagram.com/garyvee", icon: "📷" },
                { platform: "YouTube", handle: "GaryVee", url: "https://youtube.com/@GaryVee", icon: "📺" },
                { platform: "LinkedIn", handle: "garyvaynerchuk", url: "https://linkedin.com/in/garyvaynerchuk", icon: "💼" },
                { platform: "TikTok", handle: "@garyvee", url: "https://tiktok.com/@garyvee", icon: "🎵" }
              ]
            }
          ]).map((person, index) => (
            <div key={index} className="flex-shrink-0 w-64">
              <PersonCard person={person} onClick={onPersonSelect} />
            </div>
          ))}
        </div>
      </div>

      {/* Podcasts Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Podcasts</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {(searchResults?.podcasts || [
            { title: "The Tim Ferriss Show", desc: "Interviews with world-class performers", url: "https://podcasts.apple.com/podcast/id863897795", spotifyUrl: "https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk", thumbnail: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop" },
            { title: "How I Built This", desc: "Stories behind successful companies", url: "https://podcasts.apple.com/podcast/id1154105909", spotifyUrl: "https://open.spotify.com/show/6E6sTsI8O5j1dpEYFqylx8", thumbnail: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&h=200&fit=crop" },
            { title: "Huberman Lab", desc: "Neuroscience-based tools for everyday life", url: "https://podcasts.apple.com/podcast/id1545953110", spotifyUrl: "https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk", thumbnail: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop" },
            { title: "Deep Questions", desc: "Cal Newport on digital minimalism", url: "https://podcasts.apple.com/podcast/id1515788106", spotifyUrl: "https://open.spotify.com/show/6E6sTsI8O5j1dpEYFqylx8", thumbnail: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&h=200&fit=crop" },
            { title: "Smart Passive Income", desc: "Pat Flynn on online business", url: "https://podcasts.apple.com/podcast/id383651043", spotifyUrl: "https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk", thumbnail: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=200&h=200&fit=crop" }
          ]).map((podcast, index) => (
            <div key={index} className="flex-shrink-0 w-64">
              <ResourceCard title={podcast.title} desc={podcast.desc} url={podcast.url} thumbnail={podcast.thumbnail} type="podcast" spotifyUrl={podcast.spotifyUrl} onPodcastClick={onPodcastSelect} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplatesTab() { 
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Popular Templates (coming soon)</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 border border-gray-200 rounded-lg aspect-square bg-gray-50">
            <div className="font-bold text-sm">Daily 3hr GRE Study</div>
            <div className="text-xs text-gray-600 mt-1">Optimized study schedule for GRE prep</div>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg aspect-square bg-gray-50">
            <div className="font-bold text-sm">Balanced Work/School Week</div>
            <div className="text-xs text-gray-600 mt-1">Perfect balance of work, study, and personal time</div>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg aspect-square bg-gray-50">
            <div className="font-bold text-sm">Morning Fitness Routine</div>
            <div className="text-xs text-gray-600 mt-1">45-minute workout + meditation for productive days</div>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg aspect-square bg-gray-50">
            <div className="font-bold text-sm">Deep Work Focus Blocks</div>
            <div className="text-xs text-gray-600 mt-1">90-minute concentrated work sessions with breaks</div>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg aspect-square bg-gray-50">
            <div className="font-bold text-sm">Weekly Skill Building</div>
            <div className="text-xs text-gray-600 mt-1">Daily practice sessions for skill development</div>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg aspect-square bg-gray-50">
            <div className="font-bold text-sm">Language Learning Daily</div>
            <div className="text-xs text-gray-600 mt-1">30-minute daily practice for consistent progress</div>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg aspect-square bg-gray-50">
            <div className="font-bold text-sm">Creative Project Time</div>
            <div className="text-xs text-gray-600 mt-1">Dedicated hours for writing, design, or art</div>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg aspect-square bg-gray-50">
            <div className="font-bold text-sm">Social Media Detox</div>
            <div className="text-xs text-gray-600 mt-1">Reduced screen time for better focus</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-3">Create & Share</h3>
        <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
          <div className="font-bold text-gray-700 mb-2">Publish your own template</div>
          <div className="text-sm text-gray-600">Share your time management strategies with the community</div>
        </div>
      </div>
    </div>
  );
}

// --- Tiny ring component -----------------------------------------------------
function StoryRing({ percent = 0, label = "", tint = "#8CA4AF" }) {
  // 48px ring
  const size = 56;
  const r = 24;
  const c = 2 * Math.PI * r;
  const dash = c * (1 - Math.min(Math.max(percent, 0), 100) / 100);

  return (
    <div className="w-[72px] flex-shrink-0 snap-start flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 56 56" className="block">
        {/* track */}
        <circle cx="28" cy="28" r={r} fill="none" stroke="#ECEAE6" strokeWidth="6" />
        {/* progress */}
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={tint}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dash}
          style={{ transition: "stroke-dashoffset 300ms" }}
        />
        {/* % label */}
        <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="600" fill="#4E4034">
          {Math.round(percent)}%
        </text>
      </svg>
      <div className="mt-1 text-[11px] text-[#4E4034] text-center leading-tight truncate w-full">{label}</div>
    </div>
  );
}

// --- Sample feed card --------------------------------------------------------
function FeedCard({ title, children, cta }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="font-semibold text-[#4E4034] mb-1">{title}</div>
      <div className="text-[13px] text-[#6A5E53] mb-3">{children}</div>
      {cta && (
        <button className="px-3 py-1.5 rounded-lg border border-[#4E4034] text-[#4E4034] text-sm">
          {cta}
        </button>
      )}
    </div>
  );
}

  function PersonCard({ person, onClick }) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    return (
      <div 
        className="block rounded-xl border hover:shadow-sm bg-white h-32 flex flex-row cursor-pointer"
        onClick={() => onClick(person)}
      >
        {/* Profile picture on the left */}
        <div className="w-24 h-full bg-gray-100 rounded-l-xl flex items-center justify-center overflow-hidden relative flex-shrink-0">
          {person.thumbnail && !imageError ? (
            <img 
              src={person.thumbnail} 
              alt={person.name}
              className="w-full h-full object-cover"
              onLoad={() => {
                console.log(`Image loaded successfully for ${person.name}: ${person.thumbnail}`);
                setImageLoaded(true);
              }}
              onError={(e) => {
                console.log(`Image failed to load for ${person.name}: ${person.thumbnail}`, e);
                setImageError(true);
                setImageLoaded(false);
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl bg-gray-100">
              👤
            </div>
          )}
        </div>
        
        {/* Content on the right */}
        <div className="p-4 flex-1 flex flex-col justify-center">
          <div className="font-semibold leading-snug text-base line-clamp-1 mb-1">{person.name}</div>
          <div className="text-sm text-gray-500 line-clamp-2">{person.desc}</div>
        </div>
      </div>
    );
  }

  function ResourceCard({ title, desc, url, thumbnail, type = 'book', author, spotifyUrl, onPodcastClick }) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    // Determine the appropriate placeholder icon based on type
    const getPlaceholderIcon = (type) => {
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
      if (type === 'podcast' && onPodcastClick) {
        onPodcastClick({ title, desc, url, spotifyUrl, thumbnail });
      } else if (type !== 'podcast' && url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };

    // Debug logging
    useEffect(() => {
      if (thumbnail) {
        console.log(`ResourceCard ${title}: thumbnail = ${thumbnail}`);
      }
    }, [thumbnail, title]);

    return (
      <div className="block rounded-xl border hover:shadow-sm bg-white h-32 flex flex-row cursor-pointer" onClick={handleClick}>
        {/* Thumbnail on the left */}
        <div className="w-24 h-full bg-gray-100 rounded-l-xl flex items-center justify-center overflow-hidden relative flex-shrink-0">
          {thumbnail && !imageError ? (
            <img 
              src={thumbnail} 
              alt={title}
              className="w-full h-full object-cover"
              onLoad={() => {
                console.log(`Image loaded successfully for ${title}: ${thumbnail}`);
                setImageLoaded(true);
              }}
              onError={(e) => {
                console.log(`Image failed to load for ${title}: ${thumbnail}`, e);
                setImageError(true);
                setImageLoaded(false);
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl bg-gray-100">
              {getPlaceholderIcon(type)}
            </div>
          )}
        </div>
        
        {/* Content on the right */}
        <div className="p-4 flex-1 flex flex-col justify-center">
          <div className="font-semibold leading-snug text-base line-clamp-2 mb-1">{title}</div>
          {type === 'book' && author ? (
            <div className="text-sm text-gray-600 line-clamp-2">by {author}</div>
          ) : (
            <div className="text-sm text-gray-500 line-clamp-3">{desc}</div>
          )}
        </div>
      </div>
    );
  }

// --- Person Social Media Modal ------------------------------------------
function PersonSocialModal({ person, isOpen, onClose }) {
  if (!isOpen || !person) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <img 
            src={person.thumbnail} 
            alt={person.name}
            className="w-16 h-16 rounded-full object-cover"
          />
          <div>
            <h3 className="font-semibold text-xl">{person.name}</h3>
            <p className="text-sm text-gray-600">{person.desc}</p>
          </div>
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
              <span className="text-2xl">{link.icon}</span>
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

// --- Podcast Platform Modal ------------------------------------------
function PodcastPlatformModal({ podcast, isOpen, onClose }) {
  if (!isOpen || !podcast) return null;

  // Build available platforms based on what URLs we have
  const availablePlatforms = [];
  
  // Always include Apple Podcasts if we have a URL
  if (podcast.url) {
    availablePlatforms.push({
      name: 'Apple Podcasts',
      icon: '🍎',
      url: podcast.url,
      color: 'bg-gray-100 hover:bg-gray-200 text-gray-700'
    });
  }
  
  // Include Spotify if we have a Spotify URL
  if (podcast.spotifyUrl) {
    availablePlatforms.push({
      name: 'Spotify',
      icon: '🎵',
      url: podcast.spotifyUrl,
      color: 'bg-green-500 hover:bg-green-600 text-white'
    });
  }
  
  // Always include search-based platforms as fallbacks
  availablePlatforms.push({
    name: 'Google Podcasts',
    icon: '📱',
    url: `https://podcasts.google.com/search/${encodeURIComponent(podcast.title)}`,
    color: 'bg-blue-500 hover:bg-blue-600 text-white'
  });
  
  availablePlatforms.push({
    name: 'Pocket Casts',
    icon: '🎧',
    url: `https://pca.st/search?q=${encodeURIComponent(podcast.title)}`,
    color: 'bg-orange-500 hover:bg-orange-600 text-white'
  });

  // Determine if we have specific platform URLs (not just search)
  const hasSpecificPlatforms = podcast.url || podcast.spotifyUrl;
  const specificPlatformCount = (podcast.url ? 1 : 0) + (podcast.spotifyUrl ? 1 : 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <img 
            src={podcast.thumbnail} 
            alt={podcast.title}
            className="w-12 h-12 rounded-lg object-cover"
          />
          <div>
            <h3 className="font-semibold text-lg">{podcast.title}</h3>
            <p className="text-sm text-gray-600">{podcast.desc}</p>
          </div>
        </div>

        {/* Platform buttons */}
        <div className="space-y-3 mb-6">
          <p className="text-sm text-gray-500 font-medium">
            {hasSpecificPlatforms && specificPlatformCount === 1 
              ? "Only available on:" 
              : hasSpecificPlatforms 
                ? "Available on:" 
                : "Search on:"
            }
          </p>
          {availablePlatforms.map((platform, index) => (
            <a
              key={index}
              href={platform.url}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${platform.color}`}
            >
              <span className="text-xl">{platform.icon}</span>
              <span className="font-medium">{platform.name}</span>
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

// --- Focus Area Post (fake share) ------------------------------------------
function FocusAreaPost({
  author = "Alex Kim",
  handle = "@alex",
  title = "Run",
  weekLabel = "Aug 11–17",
  color = "#7EA2B7",
  dailyGoalHrs = 2,
  dayRatios = [1, 1, 1, 1, 1, 1, 1], // 0..1 for M..Su
}) {
  // Calculate weekly percentage (same logic as dashboard)
  const percent = Math.round((dayRatios.reduce((a, b) => a + (b >= 1 ? 1 : 0), 0) / 7) * 100);
  
  // Helper function to convert hex to rgba (matching dashboard)
  const hexToRGBA = (hex, alpha = 0.4) => {
    if (!hex) return `rgba(140, 164, 175, ${alpha})`;
    let h = hex.trim();
    if (h[0] === '#') h = h.slice(1);
    if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    const num = parseInt(h, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Weekly bar component (exact match to dashboard styling)
  const WeeklyBar = ({ ratio = 0, day, isOver = false }) => {
    // Use same bottomFraction calculation as dashboard (14/21)
    const bottomFraction = 14 / 21;
    const pct = Math.min(Math.max(ratio, 0), 1);
    
    return (
      <div className="relative flex flex-col items-center">
        <div className="relative w-5 h-20 flex flex-col items-center justify-end">
          {/* static track: top cap (6), gap (1), bottom body (14) */}
          <div className="absolute bottom-0 w-full h-full flex flex-col justify-end">
            <div
              className="w-full h-6 rounded-t-sm border border-[#EAECEC] bg-[#DDE5ED]"
              style={{ backgroundColor: isOver ? color : '#DDE5ED' }}
            />
            <div className="h-1" />
            <div className="w-full h-14 rounded-b-sm border border-[#EAECEC] bg-[#DDE5ED]" />
          </div>
          {/* bottom fill only (never spills into the cap) */}
          <div
            className="absolute bottom-0 w-full rounded-b-sm"
            style={{
              height: `${pct * bottomFraction * 100}%`,
              backgroundColor: hexToRGBA(color, 0.4)
            }}
          />
        </div>
        <div className="text-xs text-[#4E4034] text-center mt-1">{day}</div>
        <div className="h-[10px] mt-1" />
      </div>
    );
  };

  return (
    <article className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#ECEAE6] grid place-items-center text-sm font-semibold text-[#4E4034]">
            {author.split(" ").map(s => s[0]).join("").slice(0, 2)}
          </div>
          <div>
            <div className="text-sm font-semibold text-[#4E4034]">{author} <span className="text-[#6A5E53] font-normal">{handle}</span></div>
            <div className="text-xs text-[#6A5E53]">Shared a Focus Area • {weekLabel}</div>
          </div>
        </div>
        <button className="text-xs px-2 py-1 rounded-lg border border-[#4E4034]">Follow</button>
      </div>

      {/* Focus area snapshot - exact match to dashboard styling */}
      <div className="rounded-xl bg-[#F7F6F3] p-3">
        <div className="flex gap-4 items-center">
          {/* Left: label + ring + small texts (same proportions as dashboard) */}
          <div className="flex flex-col items-center w-28">
            <div className="text-sm font-semibold text-[#4E4034] text-center mb-1">{title}</div>
            <div className="relative w-20 h-20">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <path
                  className="text-gray-300"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Progress ring */}
                <path
                  stroke={hexToRGBA(color, 0.55)}
                  strokeWidth="3"
                  strokeDasharray={`${percent}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  transform="rotate(-90 18 18)"
                  d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-[#4E4034] leading-tight">
                <div className="text-sm">{percent}%</div>
                <div className="text-[10px] uppercase text-gray-500">week</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center mt-1">
              Daily Goal = {dailyGoalHrs}hrs
            </div>
          </div>

          {/* Right: weekly bars (exact match to dashboard) */}
          <div className="flex-1 flex flex-col w-full">
            <div className="flex justify-between items-end flex-1 mt-2 w-full px-2 py-2">
              {["M", "Tu", "W", "Th", "F", "Sa", "Su"].map((day, i) => {
                const ratio = dayRatios[i] || 0;
                const isOver = ratio > 1;
                return (
                  <WeeklyBar key={day} day={day} ratio={ratio} isOver={isOver} />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-3 text-sm">
        <button className="px-3 py-1.5 rounded-lg border border-[#4E4034] text-[#4E4034]">Like</button>
        <button className="px-3 py-1.5 rounded-lg border border-[#4E4034] text-[#4E4034]">Comment</button>
        <button className="ml-auto px-3 py-1.5 rounded-lg border border-[#4E4034] text-[#4E4034]">Duplicate</button>
      </div>
    </article>
  );
}

// --- Instagram-style Slideshow Post with multiple focus areas ---
function FocusAreaSlideshowPost({
  author = "Sarah Chen",
  handle = "@sarah",
  weekLabel = "Aug 11–17",
  focusAreas = [
    {
      title: "Study",
      color: "#7EA2B7",
      dailyGoalHrs: 4,
      dayRatios: [1, 1, 0.8, 1, 1, 0.5, 1]
    },
    {
      title: "Workout",
      color: "#B7A27E",
      dailyGoalHrs: 1,
      dayRatios: [1, 1, 1, 0, 1, 1, 0.8]
    },
    {
      title: "Reading",
      color: "#A27EB7",
      dailyGoalHrs: 1,
      dayRatios: [0.5, 1, 0.8, 1, 0.6, 1, 1]
    }
  ]
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  // Helper function to convert hex to rgba (matching dashboard)
  const hexToRGBA = (hex, alpha = 0.4) => {
    if (!hex) return `rgba(140, 164, 175, ${alpha})`;
    let h = hex.trim();
    if (h[0] === '#') h = h.slice(1);
    if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    const num = parseInt(h, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Weekly bar component (exact match to dashboard styling)
  const WeeklyBar = ({ ratio = 0, day, isOver = false, color }) => {
    const bottomFraction = 14 / 21;
    const pct = Math.min(Math.max(ratio, 0), 1);
    
    return (
      <div className="relative flex flex-col items-center">
        <div className="relative w-5 h-20 flex flex-col items-center justify-end">
          <div className="absolute bottom-0 w-full h-full flex flex-col justify-end">
            <div
              className="w-full h-6 rounded-t-sm border border-[#EAECEC] bg-[#DDE5ED]"
              style={{ backgroundColor: isOver ? color : '#DDE5ED' }}
            />
            <div className="h-1" />
            <div className="w-full h-14 rounded-b-sm border border-[#EAECEC] bg-[#DDE5ED]" />
          </div>
          <div
            className="absolute bottom-0 w-full rounded-b-sm"
            style={{
              height: `${pct * bottomFraction * 100}%`,
              backgroundColor: hexToRGBA(color, 0.4)
            }}
          />
        </div>
        <div className="text-xs text-[#4E4034] text-center mt-1">{day}</div>
        <div className="h-[10px] mt-1" />
      </div>
    );
  };

  const currentFocusArea = focusAreas[currentSlide];
  const percent = Math.round((currentFocusArea.dayRatios.reduce((a, b) => a + (b >= 1 ? 1 : 0), 0) / 7) * 100);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % focusAreas.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + focusAreas.length) % focusAreas.length);
  };

  return (
    <article className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#ECEAE6] grid place-items-center text-sm font-semibold text-[#4E4034]">
            {author.split(" ").map(s => s[0]).join("").slice(0, 2)}
          </div>
          <div>
            <div className="text-sm font-semibold text-[#4E4034]">{author} <span className="text-[#6A5E53] font-normal">{handle}</span></div>
            <div className="text-xs text-[#6A5E53]">Shared {focusAreas.length} Focus Areas • {weekLabel}</div>
          </div>
        </div>
        <button className="text-xs px-2 py-1 rounded-lg border border-[#4E4034]">Follow</button>
      </div>

      {/* Slideshow container */}
      <div className="relative rounded-xl bg-[#F7F6F3] p-3 overflow-hidden">
        {/* Slide indicators */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {focusAreas.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full ${
                index === currentSlide ? 'bg-[#4E4034]' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Navigation arrows */}
        {focusAreas.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
            >
              <svg className="w-4 h-4 text-[#4E4034]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
            >
              <svg className="w-4 h-4 text-[#4E4034]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Focus area content */}
        <div className="flex gap-4 items-center">
          <div className="flex flex-col items-center w-28">
            <div className="text-sm font-semibold text-[#4E4034] text-center mb-1">{currentFocusArea.title}</div>
            <div className="relative w-20 h-20">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <path
                  className="text-gray-300"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  stroke={hexToRGBA(currentFocusArea.color, 0.55)}
                  strokeWidth="3"
                  strokeDasharray={`${percent}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  transform="rotate(-90 18 18)"
                  d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-xs font-bold text-[#4E4034] leading-tight">
                <div className="text-sm">{percent}%</div>
                <div className="text-[10px] uppercase text-gray-500">week</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-center mt-1">
              Daily Goal = {currentFocusArea.dailyGoalHrs}hrs
            </div>
          </div>

          <div className="flex-1 flex flex-col w-full">
            <div className="flex justify-between items-end flex-1 mt-2 w-full px-2 py-2">
              {["M", "Tu", "W", "Th", "F", "Sa", "Su"].map((day, i) => {
                const ratio = currentFocusArea.dayRatios[i] || 0;
                const isOver = ratio > 1;
                return (
                  <WeeklyBar key={day} day={day} ratio={ratio} isOver={isOver} color={currentFocusArea.color} />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-3 text-sm">
        <button className="px-3 py-1.5 rounded-lg border border-[#4E4034] text-[#4E4034]">Like</button>
        <button className="px-3 py-1.5 rounded-lg border border-[#4E4034] text-[#4E4034]">Comment</button>
        <button className="ml-auto px-3 py-1.5 rounded-lg border border-[#4E4034] text-[#4E4034]">Duplicate</button>
      </div>
    </article>
  );
}

export default function ConnectPage() {
  // --- TODO: replace with real "today" values from your store/localStorage ---
  const myToday = useMemo(() => ({ goalMins: 240, spentMins: 36, color: "#7EA2B7", name: "My Progress" }), []);
  const percentMine = useMemo(() => (myToday.goalMins ? (myToday.spentMins / myToday.goalMins) * 100 : 0), [myToday]);
  
  // --- Tab state ---
  const [tab, setTab] = useState('Resources');
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedPodcast, setSelectedPodcast] = useState(null);
  const menuRef = useRef(null);
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

  // Set mounted after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // close menu when clicking outside
  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Fake follows — later, fetch from /api/connect or local cache
  const follows = [
    { name: "Noah R.", percent: 12, color: "#7EA2B7" },
    { name: "Ava M.", percent: 15, color: "#7EA2B7" },
    { name: "Noah R.", percent: 12, color: "#7EA2B7" },
    { name: "Sam T.", percent: 34, color: "#7EA2B7" },
    { name: "Priya", percent: 68, color: "#7EA2B7" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F6F3] text-[#4E4034] pb-36">
      {/* Header */}
      <header className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          {/* Left: Empty space */}
          <div className="w-10 h-10"></div>

          {/* Center: Title dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={() => setOpen(v => !v)}
              className="inline-flex items-center gap-2 text-lg font-semibold"
            >
              <span>{tab}</span>
              <svg
                width="16" height="16" viewBox="0 0 20 20"
                className={`transition-transform ${open ? 'rotate-180' : ''}`}
              >
                <path d="M5 7l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </button>
            {mounted && open && (
              <ul
                role="listbox"
                className="absolute z-10 mt-2 w-40 rounded-lg border bg-white shadow-md left-1/2 transform -translate-x-1/2"
              >
                {['Close Friends', 'Challenges', 'Resources', 'Templates'].filter(t => t !== tab).map((name) => (
                  <li key={name}>
                    <button
                      onClick={() => { setTab(name); setOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100"
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </button>
        </div>

        {/* Subtitle */}
        <p className="text-sm text-gray-500 mb-2 text-center">
          {tab === 'Close Friends' && "See friends' progress and discover templates & creators."}
          {tab === 'Challenges' && "Join challenges and track your progress with friends."}
          {tab === 'Resources' && "Find helpful resources and tools for your focus areas."}
          {tab === 'Templates' && "Browse and use time management templates from the community."}
        </p>

        {/* Divider line right under subtitle */}
        <hr className="border-gray-200 mb-3" />
      </header>



      {/* Tab Content */}
      <main className="px-4 mt-4">
        {tab === 'Close Friends' && <FeedTab />}
        {tab === 'Challenges' && <ChallengesTab />}
        {tab === 'Resources' && <ResourcesTab focusAreas={focusAreas} onPodcastSelect={setSelectedPodcast} onPersonSelect={setSelectedPerson} />}
        {tab === 'Templates' && <TemplatesTab />}
      </main>

      {/* Bottom nav (matches your style) */}
      <nav className="fixed bottom-0 left-0 right-0 p-3 pb-7 z-50">
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
      />

      {/* Podcast Platform Modal */}
      <PodcastPlatformModal 
        podcast={selectedPodcast}
        isOpen={!!selectedPodcast}
        onClose={() => setSelectedPodcast(null)}
      />
    </div>
  );
}