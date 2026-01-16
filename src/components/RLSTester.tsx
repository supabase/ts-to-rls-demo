import { useState } from 'react';
import { Play, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import Editor, { Monaco } from '@monaco-editor/react';
import * as RLS from 'ts-to-rls';

// Import bundled type definitions - single file, zero maintenance
import rlsDslBundledTypes from '../ts-to-rls-types.d.ts?raw';

const EXAMPLE_CODE = `const policy = createPolicy('user_documents')
  .on('documents')
  .for('SELECT')
  .when(column('user_id').eq(auth.uid()));

return policy.toSQL();`;

const EXAMPLES = [
  {
    name: 'User Ownership',
    code: `const policy = createPolicy('user_documents')
  .on('documents')
  .for('SELECT')
  .when(column('user_id').eq(auth.uid()));

return policy.toSQL();`,
  },
  {
    name: 'Multi-Tenant',
    code: `const policy = createPolicy('tenant_isolation')
  .on('tenant_data')
  .for('ALL')
  .restrictive()
  .when(column('tenant_id').eq(session.get('app.current_tenant_id', 'integer')));

return policy.toSQL();`,
  },
  {
    name: 'Owner or Member',
    code: `const policy = createPolicy('project_access')
  .on('projects')
  .for('SELECT')
  .when(
    column('user_id').eq(auth.uid())
      .or(
        column('id').in(
          from('project_members')
            .select('project_id')
            .where(column('user_id').eq(auth.uid()))
        )
      )
  );

return policy.toSQL();`,
  },
  {
    name: 'Complex OR',
    code: `const policy = createPolicy('project_access')
  .on('projects')
  .for('SELECT')
  .when(
    column('is_public').eq(true)
      .or(column('user_id').eq(auth.uid()))
      .or(column('organization_id').eq(session.get('app.org_id', 'uuid')))
  );

return policy.toSQL();`,
  },
  {
    name: 'With Indexes',
    code: `const policy = createPolicy('user_documents')
  .on('documents')
  .for('SELECT')
  .when(column('user_id').eq(auth.uid()));

return policy.toSQL({ includeIndexes: true });`,
  },
  {
    name: 'INSERT Validation',
    code: `const policy = createPolicy('user_documents_insert')
  .on('user_documents')
  .for('INSERT')
  .allow(column('user_id').eq(auth.uid()));

return policy.toSQL();`,
  },
  {
    name: 'UPDATE with Check',
    code: `const policy = createPolicy('user_documents_update')
  .on('user_documents')
  .for('UPDATE')
  .when(column('user_id').eq(auth.uid()))
  .withCheck(column('user_id').eq(auth.uid()));

return policy.toSQL();`,
  },
  {
    name: 'Template',
    code: `const [policy] = policies.userOwned('documents', 'SELECT');

return policy.toSQL();`,
  },
  {
    name: 'DELETE Policy',
    code: `const policy = createPolicy('user_documents_delete')
  .on('documents')
  .for('DELETE')
  .when(column('user_id').eq(auth.uid()));

return policy.toSQL();`,
  },
  {
    name: 'Pattern Matching',
    code: `const policy = createPolicy('search_documents')
  .on('documents')
  .for('SELECT')
  .when(
    column('title').ilike('%report%')
      .or(column('category').like('Finance%'))
  );

return policy.toSQL();`,
  },
  {
    name: 'Null Checks',
    code: `const policy = createPolicy('active_documents')
  .on('documents')
  .for('SELECT')
  .when(
    column('deleted_at').isNull()
      .and(column('published_at').isNotNull())
  );

return policy.toSQL();`,
  },
  {
    name: 'Public Access Template',
    code: `const policy = policies.publicAccess('documents', 'is_public');

return policy.toSQL();`,
  },
  {
    name: 'Role-Based Access',
    code: `const [policy] = policies.roleAccess('admin_data', 'admin', ['SELECT', 'UPDATE']);

return policy.toSQL();`,
  },
  {
    name: 'Helper Methods',
    code: `const policy = createPolicy('document_access')
  .on('documents')
  .for('SELECT')
  .when(
    column('user_id').isOwner()
      .or(column('is_public').isPublic())
  );

return policy.toSQL();`,
  },
];

export default function RLSTester() {
  const [input, setInput] = useState(EXAMPLE_CODE);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Configure Monaco with bundled type definitions
  const handleEditorWillMount = (monaco: Monaco) => {
    // Add bundled type definitions to Monaco
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      rlsDslBundledTypes,
      'file:///node_modules/ts-to-rls/index.d.ts'
    );

    // Create global declarations so functions work without imports
    const globalDeclarations = `
      import type * as RLS from 'ts-to-rls';

      declare global {
        const createPolicy: typeof RLS.createPolicy;
        const column: typeof RLS.column;
        const auth: typeof RLS.auth;
        const session: typeof RLS.session;
        const currentUser: typeof RLS.currentUser;
        const from: typeof RLS.from;
        const hasRole: typeof RLS.hasRole;
        const alwaysTrue: typeof RLS.alwaysTrue;
        const call: typeof RLS.call;
        const policies: typeof RLS.policies;
      }
    `;

    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      globalDeclarations,
      'file:///globals.d.ts'
    );

    // Disable diagnostics to avoid error indicators
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true,
    });

    // Configure TypeScript compiler options
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      allowJs: true,
    });
  };

  const executeCode = () => {
    try {
      setError('');

      const func = new Function(
        'createPolicy',
        'column',
        'auth',
        'session',
        'from',
        'currentUser',
        'policies',
        input
      );

      const result = func(
        RLS.createPolicy,
        RLS.column,
        RLS.auth,
        RLS.session,
        RLS.from,
        RLS.currentUser,
        RLS.policies
      );

      if (typeof result === 'string') {
        setOutput(result);
      } else {
        setError('Code must return a string (use policy.toSQL())');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setOutput('');
    }
  };

  const copyToClipboard = async () => {
    if (output) {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const loadExample = (code: string) => {
    setInput(code);
    setOutput('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-screen-2xl mx-auto p-6">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            RLS Policy DSL Tester
          </h1>
          <p className="text-slate-600">
            Test and generate PostgreSQL Row Level Security policies with TypeScript
          </p>
        </header>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Examples:</h3>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example.name}
                onClick={() => loadExample(example.code)}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                {example.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold">TypeScript Input</h2>
              <button
                onClick={executeCode}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
              >
                <Play size={16} />
                Generate
              </button>
            </div>
            <Editor
              height="600px"
              defaultLanguage="typescript"
              theme="vs-dark"
              value={input}
              onChange={(value) => setInput(value || '')}
              beforeMount={handleEditorWillMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
              }}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold">Generated SQL</h2>
              {output && (
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  {copied ? (
                    <>
                      <CheckCircle size={16} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>
            {error ? (
              <div className="flex-1 p-6 min-h-[600px]">
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                  <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                  <div>
                    <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                    <p className="text-red-700 text-sm font-mono">{error}</p>
                  </div>
                </div>
              </div>
            ) : output ? (
              <Editor
                height="600px"
                defaultLanguage="sql"
                theme="vs-dark"
                value={output}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: 'on',
                }}
              />
            ) : (
              <div className="flex items-center justify-center min-h-[600px]">
                <p className="text-slate-400 text-sm">
                  Click "Generate" to see the SQL output
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Available Functions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Policy Builder</h4>
              <code className="text-xs text-slate-600 block">
                createPolicy(name)<br />
                .on(table)<br />
                .for(operation)<br />
                .when(condition)<br />
                .toSQL()
              </code>
            </div>
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Conditions</h4>
              <code className="text-xs text-slate-600 block">
                column(name).eq(value)<br />
                .gt() .gte() .lt() .lte()<br />
                .in() .like() .isNull()<br />
                .and() .or()
              </code>
            </div>
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Context</h4>
              <code className="text-xs text-slate-600 block">
                auth.uid()<br />
                session.get(key, type)<br />
                currentUser()
              </code>
            </div>
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Subqueries</h4>
              <code className="text-xs text-slate-600 block">
                from(table)<br />
                .select(cols)<br />
                .where(condition)<br />
                .join(table, on)
              </code>
            </div>
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Templates</h4>
              <code className="text-xs text-slate-600 block">
                policies.userOwned()<br />
                policies.tenantIsolation()<br />
                policies.publicAccess()<br />
                policies.roleAccess()
              </code>
            </div>
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Operations</h4>
              <code className="text-xs text-slate-600 block">
                'SELECT' | 'INSERT'<br />
                'UPDATE' | 'DELETE'<br />
                'ALL'
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
