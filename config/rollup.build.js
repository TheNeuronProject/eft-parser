// Set up environment
import 'shelljs/global'
if (env.BUILD_TARGET !== 'DEMO') env.NODE_ENV = 'production'

// Import base config
import base from './rollup.base'

base.output.file = base.proDest
base.output.sourcemap = env.BUILD_ENV === 'DEMO' || env.BUILD_ENV === 'CI' ? base.output.sourcemap : false

export default base
