from ._version import version_info, __version__

from .pslg import *

def _jupyter_nbextension_paths():
    return [{
        'section': 'notebook',
        'src': 'static',
        'dest': 'ipymesh-widgets',
        'require': 'ipymesh-widgets/extension'
    }]
