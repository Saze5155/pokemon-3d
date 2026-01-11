
import bpy
import sys

# Nettoyer complètement
bpy.ops.wm.read_factory_settings(use_empty=True)

# Importer
bpy.ops.import_scene.fbx(filepath="C:\\Users\\Utilisateur\\Documents\\MMI3\\pokemon-3d\\assets\\sprites\\pokemons\\alakazam.fbx")

# Exporter
bpy.ops.export_scene.gltf(
    filepath="C:\\Users\\Utilisateur\\Documents\\MMI3\\pokemon-3d\\assets\\sprites\\pokemons_glb\\alakazam.glb",
    export_format='GLB',
    export_materials='EXPORT',
    export_colors=True,
    export_texcoords=True,
    export_normals=True,
    export_apply=True
)
