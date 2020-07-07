#version 150
#extension GL_ARB_explicit_attrib_location : require

#define TASK 10
#define ENABLE_LIGHTNING 0


in vec3 ray_entry_position;

layout(location = 0) out vec4 FragColor;

uniform mat4 Modelview;

uniform sampler3D volume_texture;
uniform sampler2D transfer_func_texture;

uniform vec3    camera_location;
uniform float   sampling_distance;
uniform float   iso_value;
uniform float   iso_value_2;
uniform vec3    max_bounds;
uniform ivec3   volume_dimensions;

uniform vec3    light_position;
uniform vec3    light_ambient_color;
uniform vec3    light_diffuse_color;
uniform vec3    light_specular_color;
uniform float   light_ref_coef;

uniform float light_constant;
uniform float light_linear;
uniform float light_quadratic;


bool
inside_volume_bounds(const in vec3 sampling_position)
{
    return (   all(greaterThanEqual(sampling_position, vec3(0.0)))
            && all(lessThanEqual(sampling_position, max_bounds)));
}


float
sample_data_volume(vec3 in_sampling_pos)
{
    vec3 obj_to_tex = vec3(1.0) / max_bounds;
    return texture(volume_texture, in_sampling_pos * obj_to_tex).r;

}

//Task 1.4
vec3 get_gradient(vec3 pos) {

    //central difference
    vec3 distance = max_bounds / volume_dimensions;

    float dx = (sample_data_volume(vec3(pos.x + distance.x, pos.y, pos.z))
        - sample_data_volume(vec3(pos.x - distance.x, pos.y, pos.z))) / 2;
    float dy = (sample_data_volume(vec3(pos.x, pos.y + distance.y, pos.z))
        - sample_data_volume(vec3(pos.x, pos.y - distance.y, pos.z))) / 2;
    float dz = (sample_data_volume(vec3(pos.x, pos.y, pos.z + distance.z))
        - sample_data_volume(vec3(pos.x, pos.y, pos.z - distance.z))) / 2;

    return vec3(dx, dy, dz); // /2) + 0.5 um ihn auf RGB zu mappen. Gradient = [-1,1], RGB = [0,1]
}

//function phong shading
vec4 phong_shading(vec3 sampling_pos) {

    // calculate surface normal
    vec3 normal = -normalize(get_gradient(sampling_pos));

    // calculate view direction
    vec3 view_dir = normalize(camera_location - sampling_pos);

    // ambient
    vec3 ambient = light_ambient_color;

    // diffuse
    vec3 light_dir = normalize(light_position - sampling_pos);
    float diff = max(dot(light_dir, normal), 0.0);
    vec3 diffuse = light_diffuse_color * diff;

    // specular
    vec3 halfway_dir = normalize(light_dir + view_dir);
    float spec = pow(max(dot(halfway_dir, normal), 0.0), light_ref_coef);
    vec3 specular = light_specular_color * spec;

    // attenuation
    float distance = length(normalize(light_position - sampling_pos));
    float attenuation = 1.0 / (light_constant + light_linear * distance + light_quadratic * pow(distance, 2.0));
    ambient *= attenuation;
    diffuse *= attenuation;
    specular *= attenuation;

    return vec4(ambient + diffuse + specular, 1.0);
}

void main()
{
    /// One step trough the volume
    vec3 ray_increment      = normalize(ray_entry_position - camera_location) * sampling_distance;
    /// Position in Volume
    vec3 sampling_pos       = ray_entry_position + ray_increment; // test, increment just to be sure we are in the volume

    /// Init color of fragment
    vec4 out_col = vec4(0.0, 0.0, 0.0, 0.0);

    /// check if we are inside volume
    bool inside_volume = inside_volume_bounds(sampling_pos);
    
    if (!inside_volume)
        discard;


#if TASK == 0 
// example - thresholded projection
// any rays where a sample found with value > a fixed threshold are coloured


    const float example_threshold = 0.33f;
    // the traversal loop,
    // termination when the sampling position is outside volume boundary
    while (inside_volume) 
    {      
        // get sample
        float s = sample_data_volume(sampling_pos);

        // compare sample value with threshold
        if (s > example_threshold){

            // apply the transfer function to retrieve color and opacity
            vec4 color = texture(transfer_func_texture, vec2(s, s));
            out_col = color;
            out_col = vec4(1,1,1,1);

            // stop moving ray through the volume (early ray termination)
            break;
        }
                
           
        // increment the ray sampling position
        sampling_pos  += ray_increment;

        // update the loop termination condition
        inside_volume  = inside_volume_bounds(sampling_pos);
    }


#endif 
    
#if TASK == 11 // Task 1.1: X-Ray

    int counter = 0;
    float avg = 0.0f;

    // the traversal loop,
    // termination when the sampling position is outside volume boundary
    while (inside_volume)
    {      
        // get sample
        float s = sample_data_volume(sampling_pos);

        if (s > 0.4f) {
            avg += s;
            counter++;
        }

        // increment the ray sampling position
        sampling_pos  += ray_increment;

        // update the loop termination condition
        inside_volume  = inside_volume_bounds(sampling_pos);
    }

    float tmp = avg / counter;
    out_col = texture(transfer_func_texture, vec2(tmp, tmp));
    out_col = vec4(1, 1, 1, 1 * tmp);

#endif

#if TASK == 12 // Task 1.2: Angiogram

    float threshold = 0.4f;

    // the traversal loop,
    // termination when the sampling position is outside volume boundary
    while (inside_volume)
    {      
        // get sample
        float s = sample_data_volume(sampling_pos);

        if (s > threshold) {
            threshold = s;
            out_col = texture(transfer_func_texture, vec2(threshold, threshold));
            out_col = vec4(1, 1, 1, 1 * threshold);
        }

        // increment the ray sampling position
        sampling_pos  += ray_increment;

        // update the loop termination condition
        inside_volume  = inside_volume_bounds(sampling_pos);
    }
#endif

#if TASK == 13 // Task 1.3: First-Hit Iso-Surface Ray Traversal
    
    

    // the traversal loop,
    // termination when the sampling position is outside volume boundary
    while (inside_volume)
    {      
        vec3 prev_sampling_pos;

        // get sample
        float s = sample_data_volume(sampling_pos);

        prev_sampling_pos = sampling_pos; // save sampling pos for binary search

        if (s > iso_value) {
            
            out_col = vec4(light_diffuse_color, 1.0);

            //binary search 
            //doesn't work
            /*float next_sample = sample_data_volume(sampling_pos); // get next sample

            if (s <= iso_value && next_sample >= iso_value) {

                vec3 start_pos = prev_sampling_pos,
                    mid_pos,
                    end_pos = sampling_pos;
                int temp_counter = 0, limit = 128; // limit possible iterations to save performance

                while (true) {

                    // go half length from start pos -> end up at mid pos
                    mid_pos = start_pos + (end_pos - start_pos) / 2;

                    float mid_sample = sample_data_volume(mid_pos),
                        difference = mid_sample - iso_value;

                    // success
                    if (
                        // limit to 128 runs
                        temp_counter >= limit ||
                        // test if difference between mid point and iso color is ~zero
                        mid_sample == iso_value ||
                        // == 0 (fix for floats)
                        // 0.0001 = threshold for floating point operations
                        (difference < 0.0001 && difference > -0.0001)
                        ) {
                        // get frag color at determined point on 3D volume texture
                        out_col = texture(transfer_func_texture, vec2(mid_sample, mid_sample));
                        break;
                    }

                    // otherwise half given range and try again
                    else if (mid_sample < iso_value) start_pos = mid_pos;
                    else end_pos = mid_pos;

                    temp_counter++;
                }*/

        }
    

#if ENABLE_LIGHTNING == 1 // Task 1.5: Add illumination to iso-surface
        
        out_col = vec4(get_gradient(sampling_pos), 1);
        out_col = phong_shading(sampling_pos);

#endif


        // increment the ray sampling position
        sampling_pos  += ray_increment;

        // update the loop termination condition
        inside_volume  = inside_volume_bounds(sampling_pos);
    }
#endif

    
#if TASK == 21 // Task 2.1: Front-to-back Compositing
    
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    while (inside_volume)
    {
        // get sample
        float s = sample_data_volume(sampling_pos);
     
        // dummy code
        out_col = vec4(0.0,1.0,1.0,1.0);

#if ENABLE_LIGHTNING == 1 // Task 2.3: Add illumination to front-to-back compositing
        IMPLEMENT;
#endif

        // increment the ray sampling position
        sampling_pos += ray_increment;


        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }
#endif 


#if TASK == 24 // Task 2.4: Multiple Iso-surface Compositing
    
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    while (inside_volume)
    {
        // get sample
        float s = sample_data_volume(sampling_pos);
     
        // dummy code
        out_col = vec4(1.0,1.0,0.0,1.0);

        // increment the ray sampling position
        sampling_pos += ray_increment;


        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }
#endif

#if TASK == 25 // Task 2.5: Adaptive Sampling & Opacity Correction
    
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    while (inside_volume)
    {
        // get sample
        float s = sample_data_volume(sampling_pos);
     
        // dummy code
        out_col = vec4(1.0,0.0,1.0,1.0);

        // increment the ray sampling position
        sampling_pos += ray_increment;


        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }
#endif 

    // return the calculated color value
    FragColor = out_col;
}

