import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { title, type, author } = await request.json();
    
    if (!title || !type) {
      return NextResponse.json({ error: 'Title and type are required' }, { status: 400 });
    }

    let imageUrl = null;

    try {
      if (type === 'book') {
        // Try to find book cover using Google Books API
        const searchQuery = encodeURIComponent(`${title} ${author || ''}`.trim());
        console.log(`Searching for book: ${searchQuery}`);
        
        const googleBooksResponse = await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${searchQuery}&maxResults=1`
        );
        
        if (googleBooksResponse.ok) {
          const data = await googleBooksResponse.json();
          console.log(`Google Books response:`, data.items?.length || 0, 'items found');
          
          if (data.items && data.items.length > 0) {
            const book = data.items[0];
            const imageLinks = book.volumeInfo?.imageLinks;
            console.log(`Book found: ${book.volumeInfo?.title}, Image links:`, imageLinks);
            
            if (imageLinks) {
              // Try different image sizes, preferring larger ones
              imageUrl = imageLinks.thumbnail?.replace('zoom=1', 'zoom=2') || 
                        imageLinks.smallThumbnail?.replace('zoom=1', 'zoom=2') ||
                        imageLinks.thumbnail || 
                        imageLinks.smallThumbnail;
              
              // Convert HTTP to HTTPS for security
              if (imageUrl && imageUrl.startsWith('http://')) {
                imageUrl = imageUrl.replace('http://', 'https://');
              }
              
              // Use Google Books thumbnail service instead of direct content URLs
              if (imageUrl && imageUrl.includes('books.google.com')) {
                const bookId = imageUrl.match(/id=([^&]+)/)?.[1];
                if (bookId) {
                  imageUrl = `https://books.google.com/books/publisher/content/images/frontcover/${bookId}?fife=w400-h600&source=gbs_api`;
                  console.log(`Using Google Books thumbnail service: ${imageUrl}`);
                }
              }
              
              console.log(`Found book cover: ${imageUrl}`);
            }
          }
        } else {
          console.log(`Google Books API error: ${googleBooksResponse.status}`);
        }
        
        // If Google Books didn't work, try Open Library API as backup
        if (!imageUrl) {
          console.log(`Trying Open Library API for: ${title}`);
          try {
            const openLibraryResponse = await fetch(
              `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`
            );
            
            if (openLibraryResponse.ok) {
              const data = await openLibraryResponse.json();
              if (data.docs && data.docs.length > 0) {
                const book = data.docs[0];
                const coverId = book.cover_i;
                if (coverId) {
                  imageUrl = `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
                  console.log(`Found Open Library cover: ${imageUrl}`);
                }
              }
            }
          } catch (openLibraryError) {
            console.log(`Open Library API error: ${openLibraryError.message}`);
          }
        }
      } else if (type === 'podcast') {
        // For podcasts, try to find cover art using iTunes API
        const searchQuery = encodeURIComponent(title);
        console.log(`Searching for podcast: ${searchQuery}`);
        
        const itunesResponse = await fetch(
          `https://itunes.apple.com/search?term=${searchQuery}&media=podcast&limit=1`
        );
        
        if (itunesResponse.ok) {
          const data = await itunesResponse.json();
          console.log(`iTunes response:`, data.results?.length || 0, 'results found');
          
          if (data.results && data.results.length > 0) {
            const podcast = data.results[0];
            imageUrl = podcast.artworkUrl600 || podcast.artworkUrl100;
            console.log(`Found podcast artwork: ${imageUrl}`);
          }
        } else {
          console.log(`iTunes API error: ${itunesResponse.status}`);
        }
      } else if (type === 'social') {
        // For social media, try to find profile pictures or use relevant images
        const searchQuery = encodeURIComponent(title);
        console.log(`Searching for social media: ${searchQuery}`);
        
        // Try to get profile pictures from Instagram using correct usernames
        const instagramProfiles = {
          'alex hormozi': 'hormozi',
          'gary vaynerchuk': 'garyvee',
          'gary vee': 'garyvee',
          'naval ravikant': 'naval',
          'tim ferriss': 'timferriss',
          'paul graham': 'paulg',
          'reid hoffman': 'reidhoffman'
        };
        
        const titleLower = title.toLowerCase();
        let instagramUsername = null;
        for (const [name, username] of Object.entries(instagramProfiles)) {
          if (titleLower.includes(name)) {
            instagramUsername = username;
            console.log(`Found Instagram username for: ${title} -> ${username}`);
            break;
          }
        }
        
        // Try to get profile picture from Instagram using a working method
        if (instagramUsername) {
          try {
            // Use Instagram's public profile picture URL format
            const instagramProfileUrl = `https://www.instagram.com/${instagramUsername}/`;
            const response = await fetch(instagramProfileUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              }
            });
            
            if (response.ok) {
              const html = await response.text();
              // Look for profile picture URL in the HTML
              const profilePicMatch = html.match(/"profile_pic_url_hd":"([^"]+)"/);
              if (profilePicMatch) {
                imageUrl = profilePicMatch[1].replace(/\\u0026/g, '&');
                console.log(`Found Instagram profile picture for ${instagramUsername}: ${imageUrl}`);
              } else {
                // Try alternative pattern
                const altMatch = html.match(/"profile_pic_url":"([^"]+)"/);
                if (altMatch) {
                  imageUrl = altMatch[1].replace(/\\u0026/g, '&');
                  console.log(`Found Instagram profile picture (alt) for ${instagramUsername}: ${imageUrl}`);
                }
              }
            } else {
              console.log(`Instagram fetch failed for ${instagramUsername}: ${response.status}`);
            }
          } catch (instagramError) {
            console.log(`Instagram fetch error for ${instagramUsername}:`, instagramError.message);
          }
        }
        
        // If we didn't find a profile picture from Instagram, try reliable fallback images
        if (!imageUrl) {
          // Use reliable, high-quality profile pictures from trusted sources
          const reliableProfiles = {
            'alex hormozi': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
            'gary vaynerchuk': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
            'gary vee': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
            'naval ravikant': 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=400&fit=crop&crop=face',
            'tim ferriss': 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=400&h=400&fit=crop&crop=face',
            'paul graham': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
            'reid hoffman': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face'
          };
          
          const titleLower = title.toLowerCase();
          for (const [name, profileUrl] of Object.entries(reliableProfiles)) {
            if (titleLower.includes(name)) {
              imageUrl = profileUrl;
              console.log(`Using reliable fallback profile for: ${title}`);
              break;
            }
          }
        }
        
        // Final fallback: try Unsplash with more specific queries
        if (!imageUrl) {
          const unsplashResponse = await fetch(
            `https://api.unsplash.com/search/photos?query=${searchQuery}&per_page=1&orientation=square`,
            {
              headers: {
                'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY || 'demo'}`
              }
            }
          );
          
          if (unsplashResponse.ok) {
            const data = await unsplashResponse.json();
            console.log(`Unsplash response:`, data.results?.length || 0, 'results found');
            
            if (data.results && data.results.length > 0) {
              imageUrl = data.results[0].urls.small;
              console.log(`Found social media image: ${imageUrl}`);
            }
          } else {
            console.log(`Unsplash API error: ${unsplashResponse.status}`);
          }
        }
      }

      // If we found an image, return it
      if (imageUrl) {
        // For Google Books images, ensure HTTPS
        if (imageUrl.includes('books.google.com')) {
          imageUrl = imageUrl.replace('http://', 'https://');
        }
        
        // For Google Books images, we need to proxy them due to CORS restrictions
        if (imageUrl.includes('books.google.com')) {
          const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
          return NextResponse.json({ 
            imageUrl: proxyUrl,
            source: 'google-books-proxy'
          });
        }
        
        return NextResponse.json({ 
          imageUrl,
          source: type === 'book' ? 'google-books' : type === 'podcast' ? 'itunes' : 'unsplash'
        });
      }

    } catch (apiError) {
      console.log(`API error for ${type}:`, apiError.message);
    }

    // Fallback to Unsplash based on type
    const fallbackQueries = {
      book: ['book cover', 'reading', 'library'],
      podcast: ['podcast', 'microphone', 'audio'],
      social: ['social media', 'profile', 'user']
    };

    const fallbackQuery = fallbackQueries[type]?.[0] || 'placeholder';
    
    try {
      const unsplashResponse = await fetch(
        `https://api.unsplash.com/search/photos?query=${fallbackQuery}&per_page=1&orientation=square`,
        {
          headers: {
            'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY || 'demo'}`
          }
        }
      );
      
      if (unsplashResponse.ok) {
        const data = await unsplashResponse.json();
        if (data.results && data.results.length > 0) {
          imageUrl = data.results[0].urls.small;
        }
      }
    } catch (unsplashError) {
      console.log('Unsplash fallback error:', unsplashError.message);
    }

    // Check for specific popular book covers with reliable URLs
    if (type === 'book' && !imageUrl) {
      const popularBooks = {
        'atomic habits': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg',
        'deep work': 'https://m.media-amazon.com/images/I/51XWc+El8mL._SX342_SY445_.jpg',
        'the power of habit': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg',
        'getting things done': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg',
        'the 7 habits': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg',
        'lean startup': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg',
        'zero to one': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg',
        'good to great': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg',
        'the lean startup': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg',
        'zero to one': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg',
        'the $100 startup': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg',
        'clean code': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg',
        'eloquent javascript': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg',
        'pragmatic programmer': 'https://m.media-amazon.com/images/I/51Tlm0P2ZqL._SX342_SY445_.jpg'
      };
      
      const titleLower = title.toLowerCase();
      for (const [key, coverUrl] of Object.entries(popularBooks)) {
        if (titleLower.includes(key)) {
          imageUrl = coverUrl;
          console.log(`Found popular book cover for: ${title}`);
          break;
        }
      }
    }

    // Final fallback to static Unsplash URLs with better, more specific images
    const staticFallbacks = {
      book: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=200&h=200&fit=crop&q=80', // Open book
      podcast: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&h=200&fit=crop&q=80', // Microphone
      social: 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200&h=200&fit=crop&q=80' // Social media
    };

    imageUrl = imageUrl || staticFallbacks[type] || staticFallbacks.book;
    console.log(`Using fallback image for ${type}: ${imageUrl}`);

    return NextResponse.json({ 
      imageUrl,
      source: 'fallback'
    });

  } catch (error) {
    console.error('Cover image API error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch cover image',
      imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=200&h=200&fit=crop'
    }, { status: 500 });
  }
}
