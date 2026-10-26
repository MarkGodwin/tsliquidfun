if(NOT BOX2D_BUILD_STATIC)
  message(FATAL_ERROR "ParticleSortBenchmark requires BOX2D_BUILD_STATIC=ON")
endif()
add_executable(ParticleSortBenchmark ParticleSortBenchmark.cpp)
target_include_directories(ParticleSortBenchmark PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/..)
target_link_libraries(ParticleSortBenchmark Box2D)
execute_process(COMMAND git rev-parse --short HEAD
  WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
  OUTPUT_VARIABLE BENCH_REVISION OUTPUT_STRIP_TRAILING_WHITESPACE ERROR_QUIET)
target_compile_definitions(ParticleSortBenchmark PRIVATE
  B2_BENCH_REVISION="${BENCH_REVISION}" B2_BENCH_CONFIG="$<CONFIG>")
file(GENERATE OUTPUT "${CMAKE_CURRENT_BINARY_DIR}/build-info-$<CONFIG>.txt"
  CONTENT "revision=${BENCH_REVISION}\ncompiler=${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}\nconfig=$<CONFIG>\nflags=${CMAKE_CXX_FLAGS}\nrelease_flags=${CMAKE_CXX_FLAGS_RELEASE}\ndebug_flags=${CMAKE_CXX_FLAGS_DEBUG}\nproxy_only=${BOX2D_PROFILE_PARTICLE_PROXY_ONLY}\nprofile=${BOX2D_PROFILE_PARTICLES}\nvalidation=${BOX2D_VALIDATE_PARTICLE_PROXY_SORT}\n")
