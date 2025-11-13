import { cloneDeep } from 'lodash';
import axios from 'axios';

import {
  defaultTplBible,
  defaultTplOBS,
  defaultBibleReference,
  defaultOBSReference,
} from './config/base';

export const getResources = (appConfig, resourcesApp) => {
  const resources = [];
  if (!appConfig?.lg || appConfig.lg.length > 0) {
    appConfig.lg.forEach((el) => {
      resourcesApp.forEach((r_el) => {
        if (
          r_el?.subject &&
          [
            'Bible',
            'Aligned Bible',
            'Hebrew Old Testament',
            'Greek New Testament',
          ].includes(r_el.subject) &&
          r_el.owner + '__' + r_el.name === el.i
        ) {
          resources.push(r_el.link);
        }
      });
    });
  }
  return resources;
};

export const getBookList = (bibleList, t) => {
  const result = [];
  bibleList.forEach((el) => {
    result.push({ key: el.identifier, name: t(el.identifier), label: t(el.identifier) });
  });
  return result;
};

export const getUniqueResources = (appConfig, resourcesApp) => {
  if (!appConfig?.lg || appConfig.lg.length === 0) {
    return resourcesApp;
  }
  const opened = appConfig.lg.map((el) => el.i);
  return resourcesApp.filter((el) => !opened.includes(el.owner + '__' + el.name));
};

// +
const getText = (verseObject) => {
  return verseObject.text || verseObject.nextChar || '';
};

// +
const getFootnote = (verseObject) => {
  return '/fn ' + verseObject.content + ' fn/';
};

// +
const getMilestone = (verseObject, showUnsupported) => {
  const { tag, children } = verseObject;

  switch (tag) {
    case 'k':
      return children.map((child) => getObject(child, showUnsupported)).join(' ');
    case 'zaln':
      if (children.length === 1 && children[0].type === 'milestone') {
        return getObject(children[0], showUnsupported);
      } else {
        return getAlignedWords(children);
      }
    default:
      return '';
  }
};

// +
const getAlignedWords = (verseObjects) => {
  return verseObjects
    .map((verseObject) => {
      return getWord(verseObject);
    })
    .join('');
};

// +
const getSection = (verseObject) => {
  return verseObject.content;
};

// +
const getUnsupported = (verseObject) => {
  return (
    '/' +
    verseObject.tag +
    ' ' +
    (verseObject.content || verseObject.text) +
    ' ' +
    verseObject.tag +
    '/'
  );
};

// +
const getWord = (verseObject) => {
  return verseObject.text || verseObject.content;
};

export const getVerseText = (verseObjects, showUnsupported = false) => {
  return verseObjects
    ?.map((verseObject) => getObject(verseObject, showUnsupported))
    .join('');
};

const getObject = (verseObject, showUnsupported) => {
  const { type } = verseObject;

  switch (type) {
    case 'quote':
    case 'text':
      return getText(verseObject);
    case 'milestone':
      return getMilestone(verseObject, showUnsupported);
    case 'word':
      if (verseObject.strong) {
        return getAlignedWords([verseObject]);
      } else {
        return getWord(verseObject);
      }
    case 'section':
      return getSection(verseObject);
    case 'paragraph':
      return '\n';
    case 'footnote':
      return getFootnote(verseObject);
    default:
      if (showUnsupported) {
        return getUnsupported(verseObject);
      } else {
        return '';
      }
  }
};

export const langArrToObject = (langs) => {
  let result = {};
  langs.forEach((el) => {
    result[el] = { translation: require(`./config/locales/${el}/translation.json`) };
  });
  return result;
};
/**
 *
 * @param {string} el Name
 * @param {*} val default value
 * @param {string} type is string or object or bool
 * @param {string} ext if value is object, check element
 * @returns
 */
export const checkLSVal = (el, val, type = 'string', ext = false) => {
  let value;
  switch (type) {
    case 'object':
      try {
        value = JSON.parse(localStorage.getItem(el));
      } catch (error) {
        localStorage.setItem(el, JSON.stringify(val));
        return val;
      }
      break;
    case 'boolean':
      if (localStorage.getItem(el) === null) {
        value = null;
      } else {
        value = localStorage.getItem(el) === 'true';
      }
      break;

    case 'string':
    default:
      value = localStorage.getItem(el);
      break;
  }

  if (value === null || (ext && !value[ext])) {
    localStorage.setItem(el, type === 'string' ? val : JSON.stringify(val));
    return val;
  } else {
    return value;
  }
};

/**
 * Safely sets an item in localStorage, handling quota exceeded errors
 * Attempts to clear non-critical items and retry if quota is exceeded
 *
 * @param {string} key - The key to set
 * @param {*} value - The value to set (will be stringified if not a string)
 * @returns {boolean} - True if successful, false otherwise
 */
export const safeSetItem = (key, value) => {
  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, stringValue);
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
      console.warn(
        `Storage quota exceeded when setting ${key}. Attempting to clear non-critical items.`
      );
      try {
        const criticalKeys = [
          'appConfig',
          'reference',
          'resourcesApp',
          'languageResources',
        ];
        const allKeys = Object.keys(localStorage);
        const nonCriticalKeys = allKeys.filter((k) => !criticalKeys.includes(k));

        // Remove a few non-critical items to make space
        nonCriticalKeys.slice(0, 5).forEach((k) => {
          try {
            localStorage.removeItem(k);
          } catch (e) {
            // Ignore errors when removing items
          }
        });

        // Retry setting the item
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, stringValue);
        return true;
      } catch (retryError) {
        console.error(`Failed to set ${key} even after clearing cache:`, retryError);
        return false;
      }
    }
    console.error(`Error setting localStorage item ${key}:`, error);
    return false;
  }
};

export const animate = ({ timing, draw, duration = 1000 }) => {
  let start = performance.now();

  requestAnimationFrame(function animate(time) {
    // timeFraction goes from 0 to 1
    let timeFraction = (time - start) / duration;
    if (timeFraction > 1) timeFraction = 1;

    // calculate the current animation state
    let progress = timing(timeFraction);

    draw(progress); // draw it

    if (timeFraction < 1) {
      requestAnimationFrame(animate);
    }
  });
};
const easeInOut = (timeFraction) => {
  if (timeFraction < 0.5) {
    return timeFraction * timeFraction * 2;
  } else {
    return 1 - (1 - timeFraction) * (1 - timeFraction) * 2;
  }
};

/*const linear = (timeFraction) => {
  return timeFraction;
};*/

export const animateScrollTo = (currentVerse, position) => {
  if (!currentVerse.clientHeight && !currentVerse.parentNode?.clientHeight) {
    return false;
  }
  const duration = 1000;
  const draw = (tf) => {
    let offset = 0;
    const top = currentVerse.offsetTop - 12;
    switch (position) {
      case 'center':
        offset = currentVerse.clientHeight / 2 - currentVerse.parentNode.clientHeight / 2;
        break;
      case 'top':
      default:
        break;
    }
    currentVerse.parentNode.scrollTop =
      currentVerse.parentNode.scrollTop * (1 - tf) + (top + offset) * tf;
  };
  animate({ timing: easeInOut, draw, duration });
};

export const scrollTo = (currentVerse, position) => {
  let offset = 0;
  const top = currentVerse.offsetTop - 12;
  switch (position) {
    case 'center':
      offset = currentVerse.clientHeight / 2 - currentVerse.parentNode.clientHeight / 2;
      break;
    case 'top':
    default:
      break;
  }
  currentVerse.parentNode.scrollTo(0, top + offset);
};

export const switchModeBible = (type, goToBookChapterVerse, setAppConfig) => {
  const curRef = JSON.parse(localStorage.getItem('reference'))[type];
  const appConfig = JSON.parse(localStorage.getItem('appConfig'))[type];
  setAppConfig(appConfig);
  goToBookChapterVerse(curRef.bookId, curRef.chapter, curRef.verse);
};

const resetMode = (
  defaultTpl,
  defaultReference,
  currentLanguage,
  setAppConfig,
  setLanguageResources,
  goToBookChapterVerse
) => {
  setAppConfig(defaultTpl[currentLanguage]);

  setLanguageResources((prev) => {
    const new_val = cloneDeep(prev);
    defaultTpl[currentLanguage].lg.forEach((el) => {
      if (
        !!el.i.split('__')[1]?.split('_')[0] &&
        !new_val.includes(el.i.split('__')[1]?.split('_')[0])
      ) {
        new_val.push(el.i.split('__')[1]?.split('_')[0]);
      }
    });
    return new_val;
  });

  goToBookChapterVerse(
    defaultReference[currentLanguage].bookId,
    defaultReference[currentLanguage].chapter,
    defaultReference[currentLanguage].verse
  );
};

/**
 * A function that resets the value of layouts, resources and reference
 *
 * @param {string} bookId - Current bookId
 * @param {function} setAppConfig - State function that changes appconfig
 * @param {function} goToBookChapterVerse - Function that changes reference
 * @param {string} currentLanguage - current language of app
 * @param {boolean} resetAll reset layouts,reference to default in bible and obs
 *
 */

export const resetWorkspace = ({
  bookId,
  setAppConfig,
  setLanguageResources,
  goToBookChapterVerse,
  currentLanguage,
  resetAll,
}) => {
  const workspaceType = resetAll ? 'all' : bookId === 'obs' ? 'obs' : 'bible';
  const oldAppConfig = JSON.parse(localStorage.getItem('appConfig'));
  switch (workspaceType) {
    case 'bible':
      const bibleAppConfig = {
        ...oldAppConfig,
        [workspaceType]: defaultTplBible[currentLanguage],
      };
      localStorage.setItem('appConfig', JSON.stringify(bibleAppConfig));
      resetMode(
        defaultTplBible,
        defaultBibleReference,
        currentLanguage,
        setAppConfig,
        setLanguageResources,
        goToBookChapterVerse
      );
      break;

    case 'obs':
      const obsAppConfig = {
        ...oldAppConfig,
        [workspaceType]: defaultTplOBS[currentLanguage],
      };
      localStorage.setItem('appConfig', JSON.stringify(obsAppConfig));
      resetMode(
        defaultTplOBS,
        defaultOBSReference,
        currentLanguage,
        setAppConfig,
        setLanguageResources,
        goToBookChapterVerse
      );
      break;
    case 'all':
      const allAppConfig = {
        obs: defaultTplOBS[currentLanguage],
        bible: defaultTplBible[currentLanguage],
      };
      localStorage.setItem('appConfig', JSON.stringify(allAppConfig));
      bookId === 'obs'
        ? resetMode(
            defaultTplOBS,
            defaultOBSReference,
            currentLanguage,
            setAppConfig,
            setLanguageResources,
            goToBookChapterVerse
          )
        : resetMode(
            defaultTplBible,
            defaultBibleReference,
            currentLanguage,
            setAppConfig,
            setLanguageResources,
            goToBookChapterVerse
          );
      break;
    default:
      break;
  }
};

export const getLayoutType = (layout) => {
  let type = 'bible';
  layout.forEach((el) => {
    if (el.i.split('__')[1]?.split('_')[1]?.split('-')[0] === 'obs') {
      type = 'obs';
    }
  });
  return type;
};

export const getLanguageIds = () => {
  let oldAppConfig = JSON.parse(localStorage.getItem('appConfig'));
  const allValues = [...Object.values(oldAppConfig)];
  let currentLangs = new Set();
  if (allValues) {
    allValues.forEach((value) => {
      value.lg.forEach((el) => {
        currentLangs.add(el.i.split('__')[1]?.split('_')[0]);
      });
    });
  }
  currentLangs.add(localStorage.getItem('i18nextLng'));
  return Array.from(currentLangs);
};
const equalNames = (langObj) => {
  const { lang, eng } = langObj;
  if (lang !== eng || eng === '') {
    return eng;
  } else {
    return null;
  }
};
export const packageLangs = (langObj) => {
  if (!langObj) return false;
  const eng = equalNames(langObj);
  if (eng) {
    return `${langObj.lang} (${eng})`;
  } else {
    return langObj.lang;
  }
};
export const isJson = (str) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};
export const fixUrl = (content) => {
  if (!content) {
    return;
  }
  const links = content.match(/\[{2}\S+\]{2}/g);
  if (!links) {
    return content;
  }
  let contentWithUrl = content;

  links.forEach((el) => {
    const changeUrl = contentWithUrl
      .replace('[[', `[${el.replace(/\[{2}|\]{2}/g, '')}](`)
      .replace(']]', ')');
    contentWithUrl = changeUrl;
  });

  return contentWithUrl;
};

/**
 * Highlights quote text in OBS verse text by wrapping matches in highlight spans
 * This function handles case-insensitive matching and returns React elements
 *
 * @param {string} verseText - The OBS verse text to search in
 * @param {string} quoteText - The quote text to highlight
 * @param {string} highlightClassName - CSS class name for highlighted text (default: 'obs-highlight')
 * @returns {Array} - Array of React elements (strings and highlighted spans)
 */
const markdownControlChars = new Set([
  '*',
  '_',
  '`',
  '~',
  '#',
  '>',
  '{',
  '}',
  '+',
  '=',
  '|',
]);
const smartQuoteMap = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201a': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u201e': '"',
  '\u2032': "'",
  '\u2033': '"',
};

const normalizeMarkdownText = (text) => {
  if (!text) {
    return { normalized: '', indexMap: [] };
  }

  const normalizedChars = [];
  const indexMap = [];
  let skipLinkDestination = false;

  for (let index = 0; index < text.length; index++) {
    let char = text[index];

    if (skipLinkDestination) {
      if (char === ')') {
        skipLinkDestination = false;
      }
      continue;
    }

    if (char === '(' && index > 0 && text[index - 1] === ']') {
      skipLinkDestination = true;
      continue;
    }

    if (char === '!' && index + 1 < text.length && text[index + 1] === '[') {
      continue;
    }

    if (
      markdownControlChars.has(char) ||
      char === '[' ||
      char === ']' ||
      char === '<' ||
      char === '>'
    ) {
      continue;
    }

    if (smartQuoteMap[char]) {
      char = smartQuoteMap[char];
    }

    if (/\s/.test(char)) {
      if (
        normalizedChars.length === 0 ||
        normalizedChars[normalizedChars.length - 1] === ' '
      ) {
        continue;
      }
      normalizedChars.push(' ');
      indexMap.push(index);
      continue;
    }

    const normalizedChar = char
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (!/[\p{L}\p{N}]/u.test(normalizedChar)) {
      if (
        normalizedChars.length === 0 ||
        normalizedChars[normalizedChars.length - 1] === ' '
      ) {
        continue;
      }
      normalizedChars.push(' ');
      indexMap.push(index);
      continue;
    }

    normalizedChars.push(normalizedChar);
    indexMap.push(index);
  }

  if (normalizedChars[normalizedChars.length - 1] === ' ') {
    normalizedChars.pop();
    indexMap.pop();
  }

  return {
    normalized: normalizedChars.join(''),
    indexMap,
  };
};

export const highlightTextInOBS = (
  verseText,
  quoteText,
  occurrence = 1,
  highlightClassName = 'obs-highlight'
) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('highlightTextInOBS input', {
      verseText,
      quoteText,
      occurrence,
      highlightClassName,
    });
  }
  if (!verseText) {
    return [{ type: 'text', text: '' }];
  }

  const { normalized: normalizedVerse, indexMap } = normalizeMarkdownText(verseText);
  const { normalized: normalizedQuote } = normalizeMarkdownText(quoteText);

  if (process.env.NODE_ENV === 'development') {
    console.log('highlightTextInOBS normalized', { normalizedVerse, normalizedQuote });
  }

  if (!normalizedQuote || !normalizedVerse.includes(normalizedQuote)) {
    return [{ type: 'text', text: verseText }];
  }

  const safeOccurrence = Number.isInteger(occurrence) && occurrence > 0 ? occurrence : 1;
  const matches = [];
  let searchIndex = 0;

  while (searchIndex <= normalizedVerse.length - normalizedQuote.length) {
    const foundIndex = normalizedVerse.indexOf(normalizedQuote, searchIndex);
    if (foundIndex === -1) {
      break;
    }
    if (process.env.NODE_ENV === 'development') {
      console.log('highlightTextInOBS match found', {
        occurrence: matches.length + 1,
        startNorm: foundIndex,
        endNorm: foundIndex + normalizedQuote.length,
      });
    }
    matches.push({
      startNorm: foundIndex,
      endNorm: foundIndex + normalizedQuote.length,
    });
    searchIndex = foundIndex + normalizedQuote.length;
  }

  if (matches.length === 0) {
    return [{ type: 'text', text: verseText }];
  }

  const matchToHighlight = matches[safeOccurrence - 1] || matches[0];
  if (process.env.NODE_ENV === 'development') {
    console.log('highlightTextInOBS selected match', {
      safeOccurrence,
      matchToHighlight,
      matchesCount: matches.length,
    });
  }
  const startOrigIndex = indexMap[matchToHighlight.startNorm];
  const endOrigIndex = indexMap[matchToHighlight.endNorm - 1];

  if (startOrigIndex === undefined || endOrigIndex === undefined) {
    return [{ type: 'text', text: verseText }];
  }

  const highlightStart = startOrigIndex;
  const highlightEnd = endOrigIndex + 1;

  if (process.env.NODE_ENV === 'development') {
    console.log('highlightTextInOBS highlight range', {
      highlightStart,
      highlightEnd,
      segment: verseText.slice(highlightStart, highlightEnd),
    });
  }

  const segments = [];

  if (highlightStart > 0) {
    segments.push({
      type: 'text',
      text: verseText.slice(0, highlightStart),
    });
  }

  segments.push({
    type: 'highlight',
    text: verseText.slice(highlightStart, highlightEnd),
    className: highlightClassName,
  });

  if (highlightEnd < verseText.length) {
    segments.push({
      type: 'text',
      text: verseText.slice(highlightEnd),
    });
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('highlightTextInOBS segments', segments);
  }

  return segments;
};

/**
 * Parses a repository URL and extracts owner, repository name, and ref (branch/tag)
 * Supports formats:
 * - Full URL: https://git.door43.org/owner/repo/raw/branch/master/...
 * - Short URL: owner/repo
 * - With ref: owner/repo/ref
 *
 * @param {string} url - Repository URL or path
 * @returns {Object|null} - Object with owner, repo, ref properties or null if invalid
 */
export const parseRepositoryUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Remove leading/trailing whitespace
  url = url.trim();

  // Handle full Door43 URLs
  if (url.includes('git.door43.org')) {
    const urlParts = url.split('/');
    const ownerIndex = urlParts.findIndex((part) => part === 'git.door43.org') + 1;
    if (ownerIndex > 0 && urlParts[ownerIndex]) {
      const owner = urlParts[ownerIndex];
      const repo = urlParts[ownerIndex + 1];
      // Try to find ref in URL (usually after 'raw/branch' or 'raw/tag')
      let ref = 'master';
      const rawIndex = urlParts.findIndex((part) => part === 'raw');
      if (rawIndex > 0 && urlParts[rawIndex + 1]) {
        if (urlParts[rawIndex + 2]) {
          ref = urlParts[rawIndex + 2];
        }
      }
      return owner && repo ? { owner, repo, ref } : null;
    }
  }

  // Handle simple formats: owner/repo or owner/repo/ref
  const parts = url.split('/').filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return {
      owner: parts[0],
      repo: parts[1],
      ref: parts[2] || 'master',
    };
  }

  return null;
};

/**
 * Validates if a URL string matches repository URL patterns
 *
 * @param {string} url - URL string to validate
 * @returns {boolean} - True if URL format is valid
 */
export const isValidRepositoryUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const parsed = parseRepositoryUrl(url);
  return parsed !== null;
};

/**
 * Fetches repository metadata from Door43 API
 *
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} server - Server URL (defaults to git.door43.org)
 * @returns {Promise<Object>} - Repository metadata or null if not found
 */
export const fetchRepositoryMetadata = async (
  owner,
  repo,
  server = 'https://git.door43.org'
) => {
  try {
    const response = await axios.get(`${server}/api/v1/repos/${owner}/${repo}`);
    if (response.data) {
      // Try to get catalog entry to get subject and other metadata
      try {
        const catalogResponse = await axios.get(
          `${server}/api/v1/catalog/search?limit=1&owner=${owner}&name=${repo}`
        );
        if (catalogResponse.data?.data?.length > 0) {
          const catalogEntry = catalogResponse.data.data[0];
          return {
            id: catalogEntry.id,
            owner: catalogEntry.owner.toString().toLowerCase(),
            name: catalogEntry.name,
            subject: catalogEntry.subject,
            title: catalogEntry.title,
            languageId: catalogEntry.language.toLowerCase(),
            ref: catalogEntry.branch_or_tag_name,
            link: catalogEntry.full_name + '/' + catalogEntry.branch_or_tag_name,
            isTcReady: false, // Will be set based on actual topic check
          };
        }
      } catch (e) {
        // If catalog search fails, use basic repo info
      }

      // Fallback to basic repo info if catalog search fails
      return {
        owner: owner.toLowerCase(),
        name: repo,
        ref: response.data.default_branch || 'master',
        title: response.data.name || repo,
        subject: null, // Will need to be determined from repo name/content
        languageId: null, // Will need to be extracted from repo name if possible
        link: `${owner}/${repo}`,
        isTcReady: false,
      };
    }
  } catch (error) {
    console.error('Error fetching repository metadata:', error);
    return null;
  }
  return null;
};
