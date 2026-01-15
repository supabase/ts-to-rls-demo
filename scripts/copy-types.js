import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const sourcePath = join(projectRoot, 'node_modules/rls-dsl/dist/bundle.d.ts');
const targetPath = join(projectRoot, 'src/rls-dsl-types.d.ts');

try {
  if (existsSync(sourcePath)) {
    // Copy the bundled types if they exist
    copyFileSync(sourcePath, targetPath);
    console.log('✓ Copied rls-dsl type definitions');
  } else {
    // Generate a minimal fallback from the main index.d.ts
    console.warn('⚠ bundle.d.ts not found, generating from index.d.ts');

    const indexPath = join(projectRoot, 'node_modules/rls-dsl/dist/index.d.ts');
    if (existsSync(indexPath)) {
      // Read all the individual .d.ts files and combine them
      const distDir = join(projectRoot, 'node_modules/rls-dsl/dist');
      const files = [
        'types.d.ts',
        'column.d.ts',
        'context.d.ts',
        'sql.d.ts',
        'subquery-builder.d.ts',
        'policy-builder.d.ts',
        'validation.d.ts',
        'composition.d.ts',
        'index.d.ts'
      ];

      let combined = '// Auto-generated type definitions for rls-dsl\n\n';

      for (const file of files) {
        const filePath = join(distDir, file);
        if (existsSync(filePath)) {
          let content = readFileSync(filePath, 'utf-8');
          // Remove import/export statements to inline everything
          content = content.replace(/^import .+ from .+;$/gm, '');
          content = content.replace(/^export \* from .+;$/gm, '');
          combined += content + '\n\n';
        }
      }

      writeFileSync(targetPath, combined);
      console.log('✓ Generated rls-dsl type definitions from source files');
    } else {
      // Last resort: create an empty declaration that just re-exports
      const fallback = `// Fallback type definitions\nexport * from 'rls-dsl';\n`;
      writeFileSync(targetPath, fallback);
      console.log('✓ Created fallback type definitions');
    }
  }
} catch (error) {
  console.error('Error copying types:', error.message);
  // Don't fail the build, just warn
  process.exit(0);
}
