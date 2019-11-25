import ipywidgets as widgets
from traitlets import Unicode

import ipywidgets as widgets
from traitlets import Unicode, Float, Int, Tuple, Bool, List, validate, Instance, Bytes

@widgets.register('ipymesh.PSLGEditor')
class PSLGEditor(widgets.DOMWidget):
    """Plot and edit Planar Straight Line Graphs"""
    _view_name = Unicode('PSLGEditorView').tag(sync=True)
    _model_name = Unicode('PSLGEditorModel').tag(sync=True)
    _model_module = Unicode('ipymesh-widgets').tag(sync=True)
    _view_module = Unicode('ipymesh-widgets').tag(sync=True)
    _view_module_version = Unicode('^0.1.3').tag(sync=True)
    _model_module_version = Unicode('^0.1.3').tag(sync=True)
    sync_toggle=Bool().tag(sync=True)
    width = Int().tag(sync=True)
    height = Int().tag(sync=True)
    Lx = Float(1.0).tag(sync=True)
    Ly = Float(1.0).tag(sync=True)
    image = Bytes().tag(sync=True)
    x0 = Float(0.0).tag(sync=True)
    y0 = Float(0.0).tag(sync=True)
    vertices = List().tag(sync=True)
    vertexFlags = List().tag(sync=True)
    segments = List().tag(sync=True)
    segmentFlags = List().tag(sync=True)
    regions = List().tag(sync=True)
    regionFlags = List().tag(sync=True)
    holes = List().tag(sync=True)
    boundaryTypes = List().tag(sync=True)
    regionTypes = List().tag(sync=True)

    def __init__(self, vertices=[[300,300]], vertexFlags=[1],segments=[],segmentFlags=[],regions=[],regionFlags=[],holes=[],boundaryTypes=[1,0],regionTypes=[1,0],width=600, height=600, Lx=1.0, Ly=1.0, image_filename='', x0=0.0, y0=0.0, regionConstraints=None, name="DefaultPSLGDomain", units="m", fileprefix=None, *args, **kwargs):
        super(PSLGEditor, self).__init__(*args, **kwargs)
        self.vertices=vertices
        self.vertexFlags=vertexFlags
        self.segments=segments
        self.segmentFlags=segmentFlags
        self.regions=regions
        self.regionFlags=regionFlags
        self.holes=holes
        self.width=width
        self.height=height
        self.Lx=Lx
        self.Ly=Ly
        if image_filename:
            with open(image_filename, 'rb') as f:
                self.image = f.read()
        self.x0=x0
        self.y0=y0
        self.boundaryTypes = boundaryTypes
        self.regionTypes = regionTypes
        self.sync_toggle=True
        self.polyfile = None
        self.regionConstraints = regionConstraints or []
        self.name=name
        self.units=units
        self.use_gmsh=False
    def sync(self):
        if self.sync_toggle:
            self.sync_toggle=False
        else:
            self.sync_toggle=True
