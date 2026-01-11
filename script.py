import bpy
import os

# Change ce chemin vers ton dossier de textures
texture_folder = r"C:\ton\chemin\vers\les\textures"

for mat in bpy.data.materials:
    if mat.node_tree:
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                mat_name = mat.name
                # Cherche une texture avec le même nom
                for ext in ['.dds', '.png', '.jpg']:
                    tex_path = os.path.join(texture_folder, mat_name + ext)
                    if os.path.exists(tex_path):
                        # Crée un node image
                        tex_node = mat.node_tree.nodes.new('ShaderNodeTexImage')
                        tex_node.image = bpy.data.images.load(tex_path)
                        # Connecte au Base Color
                        mat.node_tree.links.new(tex_node.outputs['Color'], node.inputs['Base Color'])
                        break