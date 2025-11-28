/**
 * Supabase Client for PDF Service
 *
 * Fetches company information from Supabase when not provided in the request.
 * This ensures mobile apps and other clients get proper company info on PDFs
 * even if they don't pass companyInfo in the request body.
 */

const { createClient } = require('@supabase/supabase-js');

const DEFAULT_COMPANY_ID = 'c0000000-0000-0000-0000-000000000001';

// Default company info used as fallback
const DEFAULT_COMPANY_INFO = {
  name: 'WIF JAPAN SDN BHD',
  address: 'Malaysia Office\nKuala Lumpur, Malaysia',
  tel: '+60-XXX-XXXXXXX',
  email: 'info@wifjapan.com',
  registrationNo: '(1594364-K)',
  registeredOffice: 'NO.6, LORONG KIRI 10, KAMPUNG DATUK KERAMAT, KUALA LUMPUR, 54000, Malaysia'
};

let supabase = null;
let cachedCompanyInfo = null;
let cacheExpiry = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

/**
 * Initialize Supabase client
 */
function initSupabase() {
  if (supabase) return supabase;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase environment variables not configured. Using default company info.');
    return null;
  }

  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
    console.log('Supabase client initialized for PDF service');
    return supabase;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
}

/**
 * Fetch company info from Supabase
 * Uses caching to reduce database calls
 */
async function fetchCompanyInfoFromSupabase() {
  // Check cache first
  if (cachedCompanyInfo && cacheExpiry && Date.now() < cacheExpiry) {
    return cachedCompanyInfo;
  }

  const client = initSupabase();
  if (!client) {
    return null;
  }

  try {
    const { data, error } = await client
      .from('companies')
      .select('*')
      .eq('id', DEFAULT_COMPANY_ID)
      .single();

    if (error) {
      console.error('Error fetching company info from Supabase:', error);
      return null;
    }

    if (!data) {
      console.warn('No company found in Supabase');
      return null;
    }

    // Transform database fields to companyInfo format
    const companyInfo = {
      name: data.name || DEFAULT_COMPANY_INFO.name,
      address: data.address || DEFAULT_COMPANY_INFO.address,
      tel: data.tel || DEFAULT_COMPANY_INFO.tel,
      email: data.email || DEFAULT_COMPANY_INFO.email,
      registrationNo: data.registration_no || DEFAULT_COMPANY_INFO.registrationNo,
      registeredOffice: data.registered_office || DEFAULT_COMPANY_INFO.registeredOffice
    };

    // Update cache
    cachedCompanyInfo = companyInfo;
    cacheExpiry = Date.now() + CACHE_TTL;

    console.log('Company info fetched from Supabase:', {
      name: companyInfo.name,
      hasAddress: !!companyInfo.address,
      hasRegistrationNo: !!companyInfo.registrationNo
    });

    return companyInfo;
  } catch (error) {
    console.error('Failed to fetch company info from Supabase:', error);
    return null;
  }
}

/**
 * Get company info - tries Supabase first, falls back to provided or defaults
 * @param {Object} providedInfo - Company info provided in the request
 * @returns {Promise<Object>} - Complete company info
 */
async function getCompanyInfo(providedInfo = {}) {
  // Check if provided info is complete
  const isProvidedComplete = providedInfo &&
    providedInfo.name &&
    providedInfo.address &&
    providedInfo.tel &&
    providedInfo.registrationNo &&
    providedInfo.registeredOffice;

  // If complete info is provided, use it
  if (isProvidedComplete) {
    return providedInfo;
  }

  // Try to fetch from Supabase
  const supabaseInfo = await fetchCompanyInfoFromSupabase();

  if (supabaseInfo) {
    // Merge: provided info takes precedence, then Supabase, then defaults
    return {
      name: providedInfo?.name || supabaseInfo.name,
      address: providedInfo?.address || supabaseInfo.address,
      tel: providedInfo?.tel || supabaseInfo.tel,
      email: providedInfo?.email || supabaseInfo.email,
      registrationNo: providedInfo?.registrationNo || supabaseInfo.registrationNo,
      registeredOffice: providedInfo?.registeredOffice || supabaseInfo.registeredOffice
    };
  }

  // Fall back to defaults if Supabase fails
  return {
    name: providedInfo?.name || DEFAULT_COMPANY_INFO.name,
    address: providedInfo?.address || DEFAULT_COMPANY_INFO.address,
    tel: providedInfo?.tel || DEFAULT_COMPANY_INFO.tel,
    email: providedInfo?.email || DEFAULT_COMPANY_INFO.email,
    registrationNo: providedInfo?.registrationNo || DEFAULT_COMPANY_INFO.registrationNo,
    registeredOffice: providedInfo?.registeredOffice || DEFAULT_COMPANY_INFO.registeredOffice
  };
}

/**
 * Clear the company info cache
 * Useful when company info is updated
 */
function clearCache() {
  cachedCompanyInfo = null;
  cacheExpiry = null;
}

module.exports = {
  getCompanyInfo,
  clearCache,
  DEFAULT_COMPANY_INFO
};
