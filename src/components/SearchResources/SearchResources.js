import React, { useContext, useEffect, useState, useRef } from 'react';

import axios from 'axios';
import { MenuItem, Menu, Button, TextField, Chip } from '@material-ui/core';
import { getXY } from 'resource-workspace-rcl';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

import { AppContext, ReferenceContext } from '../../context';
import { SelectResourcesLanguages, DialogUI, FeedbackDialog } from '../../components';

import {
  subjects,
  blackListResources,
  bibleSubjects,
  obsSubjects,
  langNames,
} from '../../config/materials';
import { defaultCard, server, columns } from '../../config/base';
import {
  getUniqueResources,
  packageLangs,
  parseRepositoryUrl,
  fetchRepositoryMetadata,
  isValidRepositoryUrl,
} from '../../helper';

import LanguageIcon from '@material-ui/icons/Language';
import LinkIcon from '@material-ui/icons/Link';

import { useStyles } from './style';

function SearchResources({ anchorEl, onClose, open }) {
  const {
    state: { appConfig, resourcesApp, languageResources },
    actions: { setAppConfig, setResourcesApp },
  } = useContext(AppContext);

  const {
    state: {
      referenceSelected: { bookId },
    },
  } = useContext(ReferenceContext);

  const { t } = useTranslation();
  const classes = useStyles();
  const [openDialog, setOpenDialog] = useState(false);
  const [openFeedbackDialog, setOpenFeedbackDialog] = useState(false);
  const [openUrlDialog, setOpenUrlDialog] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(false);

  const prevResources = useRef([]);
  const uniqueResources = getUniqueResources(appConfig, resourcesApp);
  const { enqueueSnackbar } = useSnackbar();
  const handleAddMaterial = (item) => {
    setAppConfig((prev) => {
      const next = { ...prev };
      for (let k in next) {
        const pos = getXY(appConfig[k], columns[k], defaultCard[k].h, defaultCard[k].w);
        next[k] = next[k].concat({
          ...defaultCard[k],
          x: pos.x,
          y: pos.y,
          i: item.owner + '__' + item.name,
        });
      }
      return next;
    });
    setTimeout(function () {
      document
        .querySelector('#' + item.owner + '__' + item.name + '_title')
        .scrollIntoView();
    }, 1000);
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleOpenFeedbackDialog = () => {
    handleCloseDialog();
    setOpenFeedbackDialog(true);
    onClose();
  };

  const findNewResources = (_prev, _result) => {
    if (_prev?.length > 0) {
      if (_result.length > _prev.length) {
        const result = [..._result];
        const prev = [..._prev];
        const flatPrev = prev.map((el) => el.id);
        return result.filter((res) => !flatPrev.includes(res.id));
      } else {
        return [];
      }
    }
  };

  useEffect(() => {
    // Make two parallel API calls: one standard, one filtered by tc-ready topic
    const standardQuery = axios.get(
      server +
        '/api/v1/catalog/search?limit=1000&sort=lang,title' +
        '&subject=' +
        subjects.join(',')
    );
    const tcReadyQuery = axios.get(
      server +
        '/api/v1/catalog/search?limit=1000&sort=lang,title' +
        '&subject=' +
        subjects.join(',') +
        '&topic=tc-ready'
    );

    Promise.all([standardQuery, tcReadyQuery])
      .then(([standardRes, tcReadyRes]) => {
        // Map tc-ready results with isTcReady flag
        const tcReadyMap = new Map();
        tcReadyRes.data.data.forEach((el) => {
          const key = `${el.owner.toString().toLowerCase()}__${el.name}`;
          tcReadyMap.set(key, true);
        });

        // Map standard results, marking tc-ready ones
        const standardResult = standardRes.data.data.map((el) => {
          const key = `${el.owner.toString().toLowerCase()}__${el.name}`;
          return {
            id: el.id,
            languageId: el.language.toLowerCase(),
            name: el.name,
            subject: el.subject,
            title: el.title,
            ref: el.branch_or_tag_name,
            owner: el.owner.toString().toLowerCase(),
            link: el.full_name + '/' + el.branch_or_tag_name,
            isTcReady: tcReadyMap.has(key),
          };
        });

        // Filter results
        const filtered = standardResult.filter(
          (el) =>
            !blackListResources.some(
              (value) =>
                JSON.stringify(value) ===
                JSON.stringify({ owner: el.owner, name: el.name })
            ) && languageResources.some((lang) => lang === el.languageId)
        );

        setResourcesApp((prev) => {
          if (prev && filtered) {
            prevResources.current = prev;
          }
          return filtered;
        });
      })
      .catch((err) => {
        console.log('Error fetching resources:', err);
        // Fallback to single query if parallel requests fail
        axios
          .get(
            server +
              '/api/v1/catalog/search?limit=1000&sort=lang,title' +
              '&subject=' +
              subjects.join(',')
          )
          .then((res) => {
            const result = res.data.data
              .map((el) => {
                return {
                  id: el.id,
                  languageId: el.language.toLowerCase(),
                  name: el.name,
                  subject: el.subject,
                  title: el.title,
                  ref: el.branch_or_tag_name,
                  owner: el.owner.toString().toLowerCase(),
                  link: el.full_name + '/' + el.branch_or_tag_name,
                  isTcReady: false,
                };
              })
              .filter(
                (el) =>
                  !blackListResources.some(
                    (value) =>
                      JSON.stringify(value) ===
                      JSON.stringify({ owner: el.owner, name: el.name })
                  ) && languageResources.some((lang) => lang === el.languageId)
              );
            setResourcesApp((prev) => {
              if (prev && result) {
                prevResources.current = prev;
              }
              return result;
            });
          })
          .catch((fallbackErr) => console.log('Fallback query failed:', fallbackErr));
      });
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageResources]);

  useEffect(() => {
    const newResources = findNewResources(prevResources.current, resourcesApp);
    if (newResources?.length > 0) {
      const listOBS = newResources.filter((res) =>
        obsSubjects.includes(res.subject)
      ).length;
      const listBible = newResources.filter((res) =>
        bibleSubjects.includes(res.subject)
      ).length;
      const list = `${t('Added_resources')}.
     ${listBible ? `${t('Bible')}: ${listBible}.` : ''}
    ${listOBS ? `${t('OBS')}: ${listOBS}.` : ''}`;

      enqueueSnackbar(list, { variant: 'info' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourcesApp]);

  // Sort resources: tc-ready first, then by title within each language group
  const currentSubjects = bookId === 'obs' ? obsSubjects : bibleSubjects;
  const sortedResources = [...uniqueResources]
    .filter((el) => currentSubjects.includes(el.subject))
    .sort((a, b) => {
      // First sort by language
      if (a.languageId !== b.languageId) {
        return a.languageId.localeCompare(b.languageId);
      }
      // Then by tc-ready status (tc-ready first)
      if (a.isTcReady !== b.isTcReady) {
        return a.isTcReady ? -1 : 1;
      }
      // Finally by title
      return a.title.localeCompare(b.title);
    });

  let blockLang = '';
  const menuItems = sortedResources.map((el) => {
    if (blockLang !== el.languageId) {
      blockLang = el.languageId;
      return (
        <div key={el.id}>
          <p className={classes.divider}>{packageLangs(langNames[el.languageId])}</p>
          <MenuItem className={classes.menu} onClick={() => handleAddMaterial(el)}>
            {el.title} ({el.owner})
            {el.isTcReady && (
              <Chip
                label="TC-Ready"
                size="small"
                color="primary"
                style={{ marginLeft: 8, height: 20, fontSize: '0.7rem' }}
              />
            )}
          </MenuItem>
        </div>
      );
    } else {
      return (
        <MenuItem
          className={classes.menu}
          key={el.id}
          onClick={() => handleAddMaterial(el)}
        >
          {el.title} ({el.owner})
          {el.isTcReady && (
            <Chip
              label="TC-Ready"
              size="small"
              color="primary"
              style={{ marginLeft: 8, height: 20, fontSize: '0.7rem' }}
            />
          )}
        </MenuItem>
      );
    }
  });

  const emptyMenuItems = <p className={classes.divider}>{t('No_resources')}</p>;

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };
  const handleCloseFeedbackDialog = () => {
    setOpenFeedbackDialog(false);
  };

  const handleOpenUrlDialog = () => {
    setOpenUrlDialog(true);
    setUrlInput('');
    setUrlError('');
  };

  const handleCloseUrlDialog = () => {
    setOpenUrlDialog(false);
    setUrlInput('');
    setUrlError('');
    setLoadingUrl(false);
  };

  const handleUrlSubmit = async () => {
    setUrlError('');
    setLoadingUrl(true);

    if (!urlInput.trim()) {
      setUrlError(t('Invalid_format') || 'Please enter a repository URL');
      setLoadingUrl(false);
      return;
    }

    if (!isValidRepositoryUrl(urlInput)) {
      setUrlError(t('Invalid_format') || 'Invalid repository URL format');
      setLoadingUrl(false);
      return;
    }

    const parsed = parseRepositoryUrl(urlInput);
    if (!parsed) {
      setUrlError(t('Invalid_format') || 'Could not parse repository URL');
      setLoadingUrl(false);
      return;
    }

    try {
      const metadata = await fetchRepositoryMetadata(parsed.owner, parsed.repo, server);
      if (!metadata) {
        setUrlError(t('No_content') || 'Repository not found or inaccessible');
        setLoadingUrl(false);
        return;
      }

      // Check if subject is valid for current mode
      const currentSubjects = bookId === 'obs' ? obsSubjects : bibleSubjects;
      if (metadata.subject && !currentSubjects.includes(metadata.subject)) {
        setUrlError(
          t('Warning') ||
            `This repository is not a ${bookId === 'obs' ? 'OBS' : 'Bible'} resource`
        );
        setLoadingUrl(false);
        return;
      }

      // Add to resourcesApp if not already present
      const existingIndex = resourcesApp.findIndex(
        (r) => r.owner === metadata.owner && r.name === metadata.name
      );
      if (existingIndex === -1) {
        setResourcesApp((prev) => [...prev, metadata]);
      }

      // Add to workspace
      handleAddMaterial(metadata);
      handleCloseUrlDialog();
      onClose();
    } catch (error) {
      console.error('Error adding repository:', error);
      setUrlError(t('Oops') || 'An error occurred while adding the repository');
      setLoadingUrl(false);
    }
  };

  return (
    <>
      <Menu
        color="transparent"
        anchorEl={anchorEl}
        keepMounted
        open={open}
        onClose={onClose}
      >
        <MenuItem button={false}>
          <Button
            onClick={handleOpenDialog}
            startIcon={<LanguageIcon size={'small'} />}
            variant="contained"
            color="secondary"
            size="small"
            fullWidth
          >
            {t('Add_resource_languages')}
          </Button>
        </MenuItem>
        <MenuItem button={false}>
          <Button
            onClick={handleOpenUrlDialog}
            startIcon={<LinkIcon size={'small'} />}
            variant="contained"
            color="secondary"
            size="small"
            fullWidth
          >
            {t('Add_by_url') || 'Add by URL'}
          </Button>
        </MenuItem>
        {menuItems.length !== 0 ? menuItems : emptyMenuItems}
      </Menu>
      <FeedbackDialog
        handleCloseDialog={handleCloseFeedbackDialog}
        openFeedbackDialog={openFeedbackDialog}
        title={t('If_no_language')}
      />
      <DialogUI
        title={t('Choose_languages_resources')}
        open={openDialog}
        onClose={handleCloseDialog}
        primary={{ text: t('Ok'), onClick: handleCloseDialog }}
      >
        <SelectResourcesLanguages />
        <div className={classes.link} onClick={handleOpenFeedbackDialog}>
          {t('If_no_language')}
        </div>
      </DialogUI>
      <DialogUI
        title={t('Add_by_url') || 'Add Repository by URL'}
        open={openUrlDialog}
        onClose={handleCloseUrlDialog}
        primary={{
          text: t('Add') || 'Add',
          onClick: handleUrlSubmit,
          disabled: loadingUrl,
        }}
        secondary={{ text: t('Cancel'), onClick: handleCloseUrlDialog }}
      >
        <TextField
          fullWidth
          label={t('Repository_url') || 'Repository URL'}
          placeholder="owner/repo or https://git.door43.org/owner/repo"
          value={urlInput}
          onChange={(e) => {
            setUrlInput(e.target.value);
            setUrlError('');
          }}
          error={!!urlError}
          helperText={
            urlError || t('Repository_url_help') || 'Enter owner/repo or full Door43 URL'
          }
          disabled={loadingUrl}
          autoFocus
        />
      </DialogUI>
    </>
  );
}

export default SearchResources;
