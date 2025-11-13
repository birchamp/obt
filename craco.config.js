module.exports = {
  babel: {
    plugins: [
      '@babel/plugin-proposal-optional-chaining',
      '@babel/plugin-proposal-nullish-coalescing-operator',
    ],
  },
  webpack: {
    configure: (webpackConfig) => {
      // Fix react-draggable compilation issue with optional chaining
      // Add a specific rule BEFORE the main rules that includes react-draggable
      const rule = webpackConfig.module.rules.find((rule) =>
        rule.oneOf
      );
      
      if (rule && rule.oneOf) {
        // Find the first babel-loader rule to copy its configuration
        const babelRule = rule.oneOf.find(
          (r) => r.use && (
            (Array.isArray(r.use) && r.use.some(u => u.loader && u.loader.includes('babel-loader'))) ||
            (r.use.loader && r.use.loader.includes('babel-loader'))
          )
        );
        
        if (babelRule) {
          // Get the babel-loader configuration
          const babelLoaderConfig = Array.isArray(babelRule.use) 
            ? babelRule.use.find(u => u.loader && u.loader.includes('babel-loader'))
            : babelRule.use.loader && babelRule.use.loader.includes('babel-loader') ? babelRule.use : null;
          
          if (babelLoaderConfig) {
            // Insert a rule at the beginning that specifically includes react-draggable
            rule.oneOf.unshift({
              test: /\.(js|mjs|jsx)$/,
              include: /node_modules[\\/]react-draggable/,
              use: Array.isArray(babelRule.use) ? babelRule.use : [babelRule.use],
            });
          }
        }
        
        // Also modify exclude rules to not exclude react-draggable
        rule.oneOf.forEach((r) => {
          if (r.test && (
            r.test.toString().includes('jsx') || 
            r.test.toString().includes('mjs') ||
            r.test.toString().includes('\\.js')
          )) {
            if (r.exclude && typeof r.exclude === 'function') {
              const originalExclude = r.exclude;
              r.exclude = (modulePath) => {
                if (modulePath && modulePath.includes('react-draggable')) {
                  return false;
                }
                return originalExclude(modulePath);
              };
            } else if (r.exclude instanceof RegExp) {
              const originalExclude = r.exclude;
              r.exclude = (modulePath) => {
                if (modulePath && modulePath.includes('react-draggable')) {
                  return false;
                }
                return originalExclude.test(modulePath);
              };
            }
          }
        });
      }


      // Alias scripture-resources-rcl to @texttree/scripture-resources-rcl to avoid duplication
      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.alias = webpackConfig.resolve.alias || {};
      webpackConfig.resolve.alias['scripture-resources-rcl'] = '@texttree/scripture-resources-rcl';

      // Existing optimization config
      webpackConfig.optimization = {
        ...webpackConfig.optimization,
        splitChunks: {
          cacheGroups: {
            'vendor-material-ui': {
              name: 'vendor-material-ui',
              test: /[\\/]node_modules[\\/]@material-ui[\\/]/,
              chunks: 'initial',
              priority: 2,
            },
            'vendor-react': {
              name: 'vendor-sr-rcl',
              test: /[\\/]node_modules[\\/]@texttree\/scripture-resources-rcl[\\/]/,
              chunks: 'initial',
              priority: 3,
            },
            'vendor-all': {
              name: 'vendor-all',
              test: /[\\/]node_modules[\\/]/,
              chunks: 'initial',
              priority: 1,
            },
          },
          maxSize: 7000000,
        },
        runtimeChunk: {
          name: 'manifest',
        },
      };

      return webpackConfig;
    },
  },
};
